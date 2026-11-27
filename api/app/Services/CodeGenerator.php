<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Human-readable sequential codes, e.g. PAHE-L-2026-0001 (listing) or PAHE-AR-2026-0001 (access request).
 * The sequence is derived from the highest existing code for the year inside the caller's transaction.
 */
class CodeGenerator
{
    public function next(string $table, string $column, string $type, int $pad = 4): string
    {
        $prefix = sprintf('%s-%s-%s-', config('estate.code_prefix'), $type, now()->year);

        $last = DB::table($table)
            ->where($column, 'like', $prefix.'%')
            ->lockForUpdate()
            ->orderByDesc($column)
            ->value($column);

        $sequence = $last ? ((int) substr($last, strlen($prefix))) + 1 : 1;

        return $prefix.str_pad((string) $sequence, $pad, '0', STR_PAD_LEFT);
    }
}
