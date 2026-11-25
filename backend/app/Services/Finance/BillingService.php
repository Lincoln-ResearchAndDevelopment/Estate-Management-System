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

            $bill = DB::transaction(fn () => Bill::create([
                'reference' => $this->codes->next('bills', 'reference', 'B', 5),
                'household_id' => $household->id,
                'service_id' => $service->id,
                'description' => $service->name.($period ? " ({$period})" : ''),
                'period_label' => $period,
                'amount' => $service->amount,
                'due_date' => $date->copy()->startOfDay()->addDays($service->due_days)->toDateString(),
                'status' => 'unpaid',
                'created_by' => $actor?->id,
            ]));
            $created++;

            $this->notifyHousehold($household, 'New bill: '.$bill->description, '₦'.number_format((float) $bill->amount, 2).' due '.$bill->due_date->format('M j, Y'), '/resident/finance');
        }

        return $created;
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
