<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmergencyAlert extends Model
{

    public const ACTIVE = ['raised', 'acknowledged', 'dispatched'];
    public const TYPES = ['panic', 'medical', 'fire', 'security'];

    protected $fillable = ['reference', 'type', 'raised_by', 'household_id', 'unit_id', 'lat', 'lng', 'description', 'status', 'acknowledged_by', 'acknowledged_at', 'responder_id', 'dispatched_at', 'resolved_by', 'resolved_at', 'resolution_note', 'escalated_at'];

    protected function casts(): array
    {
        return ['lat' => 'float', 'lng' => 'float', 'acknowledged_at' => 'datetime', 'dispatched_at' => 'datetime', 'resolved_at' => 'datetime', 'escalated_at' => 'datetime'];
    }

    public function raiser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'raised_by');
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }

    public function responder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responder_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(AlertEvent::class, 'alert_id');
    }
}
