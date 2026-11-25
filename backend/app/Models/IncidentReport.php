<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IncidentReport extends Model
{

    public const CATEGORIES = ['theft', 'suspicious_activity', 'trespass', 'vandalism', 'noise', 'fire_hazard', 'other'];
    public const SEVERITIES = ['low', 'medium', 'high', 'critical'];

    protected $fillable = ['reference', 'title', 'category', 'severity', 'location', 'description', 'reported_by', 'assigned_to', 'status', 'closed_at'];

    protected function casts(): array
    {
        return ['closed_at' => 'datetime'];
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reported_by');
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function notes(): HasMany
    {
        return $this->hasMany(IncidentNote::class);
    }
}
