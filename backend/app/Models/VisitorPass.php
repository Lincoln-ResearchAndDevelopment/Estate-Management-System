<?php

namespace App\Models;

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
}
