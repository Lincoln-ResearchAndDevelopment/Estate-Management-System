<?php

namespace App\Services\Finance;

use App\Models\Bill;
use App\Models\Household;
use App\Models\Service;
use App\Models\User;
use App\Notifications\GenericNotification;
use App\Services\AuditLogger;
use App\Services\CodeGenerator;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * WF-03 billing cycle. Auto-billing creates one bill per household, service and period; running it
 * twice for the same period creates nothing new (unique household + service + period).
 */
class BillingService
{
    public function __construct(private readonly CodeGenerator $codes, private readonly AuditLogger $audit) {}

    public static function periodLabel(Service $service, CarbonInterface $date): ?string
    {
        return match ($service->frequency) {
            'monthly' => $date->format('Y-m'),
            'quarterly' => $date->format('Y').'-Q'.$date->quarter,
            'yearly' => $date->format('Y'),
            default => null,
        };
    }

    /** First day of the period a bill covers (null for one-off charges). */
    public static function periodStart(Service $service, CarbonInterface $date): ?CarbonInterface
    {
        return match ($service->frequency) {
            'monthly' => $date->copy()->startOfMonth(),
            'quarterly' => $date->copy()->startOfQuarter(),
            'yearly' => $date->copy()->startOfYear(),
            default => null,
        };
    }

    /** Active monthly services that apply to a household (what the resident pays each month). */
    public function monthlyServicesFor(Household $household): Collection
    {
        return Service::query()->where('is_active', true)->where('frequency', 'monthly')
            ->where(fn ($q) => $q->where('applies_to', 'all')
                ->orWhereHas('households', fn ($h) => $h->where('households.id', $household->id)))
            ->orderBy('name')->get();
    }

    /**
     * Ensures the household has a bill for each monthly service for each chosen month ("Y-m"), so a
     * resident can pay month by month, including up to 12 months ahead. Returns the open bills for those months.
     *
     * @param  list<string>  $periods
     */
    public function billMonths(Household $household, array $periods, ?User $actor = null): Collection
    {
        $latest = now()->startOfMonth()->addMonths(12);
        $services = $this->monthlyServicesFor($household);
        $bills = collect();

        foreach (array_unique($periods) as $period) {
            if (! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $period)) {
                throw \App\Exceptions\BusinessRuleException::invalidState("{$period} is not a valid month.");
            }
            $month = \Illuminate\Support\Carbon::createFromFormat('Y-m-d', $period.'-01')->startOfDay();
            if ($month->greaterThan($latest)) {
                throw \App\Exceptions\BusinessRuleException::invalidState('You can pay at most 12 months ahead.');
            }
            foreach ($services as $service) {
                $existing = Bill::query()->where('household_id', $household->id)->where('service_id', $service->id)
                    ->where('period_label', $period)->first();
                if ($existing) {
                    if (in_array($existing->status, Bill::OPEN, true)) {
                        $bills->push($existing);
                    }

                    continue;
                }
                // Only months that have not started yet may be created here; past months come from the billing run.
                if ($month->lessThan(now()->startOfMonth())) {
                    continue;
                }
                $bills->push($this->billHousehold($service, $household, $month, $actor, notify: false));
            }
        }

        return $bills->unique('id')->values();
    }

    /** Households a service applies to. */
    public function householdsFor(Service $service): Collection
    {
        return $service->applies_to === 'selected'
            ? $service->households()->get()
            : Household::query()->whereNotNull('head_user_id')->get();
    }

    /**
     * Generates bills for every active auto-bill service for the period containing $date.
     *
     * @return int number of bills created
     */
    public function runAutoBilling(?CarbonInterface $date = null): int
    {
        $date ??= now();
        $created = 0;

        Service::query()->where('is_active', true)->where('auto_bill', true)->where('frequency', '!=', 'one_off')
            ->each(function (Service $service) use ($date, &$created) {
                $created += $this->billService($service, $date);
            });

        return $created;
    }

    public function billService(Service $service, CarbonInterface $date, ?User $actor = null): int
    {
        $period = self::periodLabel($service, $date);
        $created = 0;

        foreach ($this->householdsFor($service) as $household) {
            $exists = Bill::query()->where('household_id', $household->id)->where('service_id', $service->id)
                ->where('period_label', $period)->exists();
            if ($exists) {
                continue;
            }
            $this->billHousehold($service, $household, $date, $actor);
            $created++;
        }

        return $created;
    }

    /** Creates one household's bill for the period containing $date (callers check for duplicates). */
    public function billHousehold(Service $service, Household $household, CarbonInterface $date, ?User $actor = null, bool $notify = true): Bill
    {
        $period = self::periodLabel($service, $date);
        $start = self::periodStart($service, $date);
        // Due a set number of days after the period starts (or after today, for a period already under way).
        $base = $start && $start->greaterThan(now()) ? $start->copy() : now()->startOfDay();
        $label = $start && $service->frequency === 'monthly' ? $start->format('M Y') : $period;

        $bill = DB::transaction(fn () => Bill::create([
            'reference' => $this->codes->next('bills', 'reference', 'B', 5),
            'household_id' => $household->id,
            'service_id' => $service->id,
            'description' => $service->name.($label ? " ({$label})" : ''),
            'period_label' => $period,
            'period_start' => $start?->toDateString(),
            'amount' => $service->amount,
            'due_date' => $base->addDays($service->due_days)->toDateString(),
            'status' => 'unpaid',
            'created_by' => $actor?->id,
        ]));

        if ($notify) {
            $this->notifyHousehold($household, 'New bill: '.$bill->description, '₦'.number_format((float) $bill->amount, 2).' due '.$bill->due_date->format('M j, Y'), '/resident/finance');
        }

        return $bill;
    }

    /**
     * One-off bill issued by finance to selected households (e.g. a special levy).
     *
     * @param  list<int>  $householdIds
     */
    public function issueManual(array $householdIds, string $description, float $amount, string $dueDate, User $actor): int
    {
        $count = 0;
        foreach (Household::query()->whereIn('id', $householdIds)->get() as $household) {
            DB::transaction(fn () => Bill::create([
                'reference' => $this->codes->next('bills', 'reference', 'B', 5),
                'household_id' => $household->id,
                'description' => $description,
                'amount' => $amount,
                'due_date' => $dueDate,
                'status' => 'unpaid',
                'created_by' => $actor->id,
            ]));
            $count++;
            $this->notifyHousehold($household, 'New bill: '.$description, '₦'.number_format($amount, 2).' due '.date('M j, Y', strtotime($dueDate)), '/resident/finance');
        }

        $this->audit->log('bills.issued', 'Bill', null, ['households' => $count, 'description' => $description, 'amount' => $amount], $actor);

        return $count;
    }

    public function void(Bill $bill, User $actor, string $reason): Bill
    {
        if ((float) $bill->amount_paid > 0 || $bill->status === 'void') {
            throw \App\Exceptions\BusinessRuleException::invalidState('Only unpaid bills can be voided.');
        }
        $bill->update(['status' => 'void']);
        $this->audit->log('bill.voided', $bill, null, ['reason' => $reason], $actor);

        return $bill;
    }

    /** Marks unpaid / part-paid bills past their due date as overdue. Returns the count changed. */
    public function markOverdue(): int
    {
        return Bill::query()->whereIn('status', ['unpaid', 'part_paid'])
            ->where('due_date', '<', now()->toDateString())
            ->update(['status' => 'overdue', 'updated_at' => now()]);
    }

    /** Recomputes a bill's status from what has been paid. */
    public static function refreshStatus(Bill $bill): void
    {
        $paid = (float) $bill->amount_paid;
        $bill->status = match (true) {
            $bill->status === 'void' => 'void',
            $paid >= (float) $bill->amount => 'paid',
            $bill->due_date->lt(now()->startOfDay()) => 'overdue',
            $paid > 0 => 'part_paid',
            default => 'unpaid',
        };
        $bill->save();
    }

    private function notifyHousehold(Household $household, string $title, string $body, string $link): void
    {
        $users = User::query()->whereHas('resident', fn ($q) => $q->where('household_id', $household->id))->get();
        Notification::send($users, new GenericNotification($title, $body, $link, 'finance'));
    }
}
