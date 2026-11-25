<?php

namespace App\Http\Controllers\Api\V1\Reports;

use App\Http\Controllers\Controller;
use App\Models\AccessLog;
use App\Models\Bill;
use App\Models\EmergencyAlert;
use App\Models\IncidentReport;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PropertyListing;
use App\Models\Resident;
use App\Services\AuditLogger;
use Carbon\CarbonPeriod;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * M14 reports & analytics (SCR-RPT-01–03): one summary endpoint for the dashboard charts and CSV
 * exports streamed straight from the database (no figures are typed in by hand).
 */
class ReportsController extends Controller
{
    public const EXPORTS = ['payments', 'bills', 'access-logs', 'alerts', 'incidents', 'residents', 'orders'];

    public function summary(Request $request): JsonResponse
    {
        [$from, $to] = $this->range($request);

        $months = collect(CarbonPeriod::create($from->copy()->startOfMonth(), '1 month', $to->copy()->startOfMonth()))->map(fn ($m) => $m->copy());

        $revenue = $months->map(fn (Carbon $m) => [
            'month' => $m->format('M Y'),
            'collected' => round((float) Payment::where('status', 'success')->whereBetween('paid_at', [$m->copy()->startOfMonth(), $m->copy()->endOfMonth()])->sum('amount'), 2),
            'billed' => round((float) Bill::where('status', '!=', 'void')->whereBetween('created_at', [$m->copy()->startOfMonth(), $m->copy()->endOfMonth()])->sum('amount'), 2),
        ])->values();

        $byService = Bill::query()->join('services', 'services.id', '=', 'bills.service_id')
            ->whereBetween('bills.created_at', [$from, $to])->where('bills.status', '!=', 'void')
            ->selectRaw('services.name as name, sum(bills.amount_paid) as collected, sum(bills.amount) as billed')
            ->groupBy('services.name')->orderByDesc('billed')->get()
            ->map(fn ($r) => ['name' => $r->name, 'collected' => round((float) $r->collected, 2), 'billed' => round((float) $r->billed, 2)]);

        $alertsByType = EmergencyAlert::whereBetween('created_at', [$from, $to])->selectRaw('type, count(*) as total')->groupBy('type')->pluck('total', 'type');
        $alertsByStatus = EmergencyAlert::whereBetween('created_at', [$from, $to])->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        $entries = AccessLog::where('direction', 'in')->whereBetween('occurred_at', [$from, $to])
            ->where(fn ($q) => $q->whereNull('flag_reason')->orWhere('flag_reason', 'not like', 'REFUSED%'))
            ->selectRaw('DATE(occurred_at) as day, count(*) as total')->groupBy('day')->orderBy('day')->pluck('total', 'day');

        $billed = (float) Bill::where('status', '!=', 'void')->whereBetween('created_at', [$from, $to])->sum('amount');
        $collected = (float) Payment::where('status', 'success')->whereBetween('paid_at', [$from, $to])->sum('amount');

        return response()->json(['data' => [
            'range' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
            'finance' => [
                'billed' => round($billed, 2),
                'collected' => round($collected, 2),
                'collectionRate' => $billed > 0 ? round(min(100, $collected / $billed * 100), 1) : null,
                'outstanding' => round((float) Bill::whereIn('status', Bill::OPEN)->sum(DB::raw('amount - amount_paid')), 2),
                'revenueByMonth' => $revenue,
                'byService' => $byService,
            ],
            'security' => [
                'alerts' => (int) $alertsByType->sum(),
                'alertsByType' => $alertsByType,
                'alertsByStatus' => $alertsByStatus,
                'falseAlarmRate' => $alertsByType->sum() ? round(((int) ($alertsByStatus['false_alarm'] ?? 0)) / $alertsByType->sum() * 100, 1) : null,
                'incidents' => IncidentReport::whereBetween('created_at', [$from, $to])->count(),
            ],
            'access' => [
                'entries' => (int) $entries->sum(),
                'refused' => AccessLog::where('flag_reason', 'like', 'REFUSED%')->whereBetween('occurred_at', [$from, $to])->count(),
                'entriesByDay' => $entries->map(fn ($v, $k) => ['day' => $k, 'entries' => (int) $v])->values(),
            ],
            'community' => [
                'activeResidents' => Resident::where('status', 'active')->count(),
                'liveListings' => PropertyListing::publiclyVisible()->count(),
                'ordersDelivered' => Order::where('status', 'delivered')->whereBetween('updated_at', [$from, $to])->count(),
            ],
        ]]);
    }

    public function export(Request $request, string $type, AuditLogger $audit): StreamedResponse
    {
        abort_unless(in_array($type, self::EXPORTS, true), 404);
        [$from, $to] = $this->range($request);
        $audit->log('report.exported', 'Report', null, ['type' => $type, 'from' => $from->toDateString(), 'to' => $to->toDateString()]);

        [$headers, $query, $row] = match ($type) {
            'payments' => [
                ['Reference', 'Receipt', 'Unit', 'Payer', 'Method', 'Status', 'Amount (NGN)', 'Paid at'],
                Payment::with(['household.unit', 'user'])->whereBetween('created_at', [$from, $to])->orderBy('id'),
                fn ($p) => [$p->reference, $p->receipt_number, $p->household?->unit?->unit_code, $p->user?->name, $p->method, $p->status, $p->amount, $p->paid_at?->toDateTimeString()],
            ],
            'bills' => [
                ['Reference', 'Unit', 'Description', 'Amount (NGN)', 'Paid (NGN)', 'Due date', 'Status'],
                Bill::with('household.unit')->whereBetween('created_at', [$from, $to])->orderBy('id'),
                fn ($b) => [$b->reference, $b->household?->unit?->unit_code, $b->description, $b->amount, $b->amount_paid, $b->due_date?->toDateString(), $b->status],
            ],
            'access-logs' => [
                ['Time', 'Direction', 'Type', 'Name', 'Plate', 'Unit', 'Gate', 'Officer', 'Flag'],
                AccessLog::with(['household.unit', 'officer'])->whereBetween('occurred_at', [$from, $to])->orderBy('id'),
                fn ($l) => [$l->occurred_at?->toDateTimeString(), $l->direction, $l->subject_type, $l->person_name, $l->plate_number, $l->household?->unit?->unit_code, $l->gate, $l->officer?->name, $l->flag_reason],
            ],
            'alerts' => [
                ['Reference', 'Type', 'Status', 'Raised by', 'Unit', 'Raised at', 'Acknowledged at', 'Resolved at', 'Resolution'],
                EmergencyAlert::with(['raiser', 'unit'])->whereBetween('created_at', [$from, $to])->orderBy('id'),
                fn ($a) => [$a->reference, $a->type, $a->status, $a->raiser?->name, $a->unit?->unit_code, $a->created_at?->toDateTimeString(), $a->acknowledged_at?->toDateTimeString(), $a->resolved_at?->toDateTimeString(), $a->resolution_note],
            ],
            'incidents' => [
                ['Reference', 'Title', 'Category', 'Severity', 'Status', 'Reported by', 'Created'],
                IncidentReport::with('reporter')->whereBetween('created_at', [$from, $to])->orderBy('id'),
                fn ($r) => [$r->reference, $r->title, $r->category, $r->severity, $r->status, $r->reporter?->name, $r->created_at?->toDateTimeString()],
            ],
            'residents' => [
                ['Name', 'Relationship', 'Unit', 'Phone', 'Status', 'Has login'],
                Resident::with('household.unit')->orderBy('id'),
                fn ($r) => [$r->full_name, $r->relationship, $r->household?->unit?->unit_code, $r->phone, $r->status, $r->user_id ? 'Yes' : 'No'],
            ],
            'orders' => [
                ['Reference', 'Store', 'Buyer', 'Status', 'Total (NGN)', 'Placed'],
                Order::with(['store', 'buyer'])->whereBetween('created_at', [$from, $to])->orderBy('id'),
                fn ($o) => [$o->reference, $o->store?->name, $o->buyer?->name, $o->status, $o->total, $o->created_at?->toDateTimeString()],
            ],
        };

        $filename = sprintf('pahe-%s-%s-to-%s.csv', $type, $from->toDateString(), $to->toDateString());

        return response()->streamDownload(function () use ($headers, $query, $row) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel shows ₦ and accents correctly
            fputcsv($out, $headers);
            $query->chunk(500, function ($rows) use ($out, $row) {
                foreach ($rows as $r) {
                    // Neutralise spreadsheet formula injection in user-entered text.
                    fputcsv($out, array_map(fn ($v) => is_string($v) && preg_match('/^[=+\-@]/', $v) ? "'".$v : $v, $row($r)));
                }
            });
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** @return array{0: Carbon, 1: Carbon} */
    private function range(Request $request): array
    {
        $data = $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date', 'after_or_equal:from'], 'preset' => ['nullable', Rule::in(['30d', '90d', 'ytd', '12m'])]]);
        $to = isset($data['to']) ? Carbon::parse($data['to'])->endOfDay() : now()->endOfDay();
        $from = isset($data['from']) ? Carbon::parse($data['from'])->startOfDay() : match ($data['preset'] ?? '12m') {
            '30d' => now()->subDays(30)->startOfDay(),
            '90d' => now()->subDays(90)->startOfDay(),
            'ytd' => now()->startOfYear(),
            default => now()->subMonths(11)->startOfMonth(),
        };

        return [$from, $to];
    }
}
