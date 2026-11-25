<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class VisitorPass extends Model
{
    protected $fillable = ['code', 'household_id', 'created_by', 'visitor_name', 'visitor_phone', 'purpose', 'vehicle_plate', 'valid_from', 'valid_until', 'max_entries', 'entries_used', 'status'];

    protected function casts(): array
    {
        return ['valid_from' => 'datetime', 'valid_until' => 'datetime', 'max_entries' => 'integer', 'entries_used' => 'integer'];
    }

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(AccessLog::class);
    }

    /** Visitors whose latest (non-refused) gate record is an entry, i.e. currently inside the estate. */
    public function scopeInside(Builder $query): Builder
    {
        return $query->whereRaw("(SELECT direction FROM access_logs WHERE access_logs.visitor_pass_id = visitor_passes.id AND (flag_reason IS NULL OR flag_reason NOT LIKE 'REFUSED%') ORDER BY occurred_at DESC, id DESC LIMIT 1) = 'in'");
    }
}
