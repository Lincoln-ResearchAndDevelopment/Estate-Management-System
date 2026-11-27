<?php

namespace App\Services\Finance;

use App\Models\Bill;
use App\Models\Household;

/**
 * A household is "cleared" when nothing is owed for the current period or earlier. Bills for months a
 * resident chose to pay ahead do not count against them until that month starts. A bill only stops
 * counting once its payment is confirmed (gateway-verified or approved by finance).
 */
class ClearanceService
{
    /** @return array{cleared: bool, outstanding: float, dueBills: int} */
    public function status(Household $household): array
    {
        $due = Bill::query()->where('household_id', $household->id)->whereIn('status', Bill::OPEN)
            ->where(fn ($q) => $q->whereNull('period_start')->orWhere('period_start', '<=', now()->toDateString()))
            ->get();
        $outstanding = round($due->sum(fn (Bill $b) => $b->balance()), 2);

        return ['cleared' => $outstanding <= 0, 'outstanding' => $outstanding, 'dueBills' => $due->count()];
    }
}
