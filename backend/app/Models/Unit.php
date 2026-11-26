<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Unit extends Model
{
    use HasFactory;

    public const OCCUPANCY = ['occupied', 'vacant', 'under_watch'];

    protected $fillable = ['unit_code', 'sector_id', 'street_id', 'unit_type', 'rooms', 'occupancy_status', 'lat', 'lng'];

    protected function casts(): array
    {
        return ['rooms' => 'integer', 'lat' => 'float', 'lng' => 'float'];
    }

    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }

    public function street(): BelongsTo
    {
        return $this->belongsTo(Street::class);
    }

    public function households(): HasMany
    {
        return $this->hasMany(Household::class);
    }

    public function scopeFilter(Builder $query, array $filters): Builder
    {
        return $query
            ->when($filters['sector_id'] ?? null, fn ($q, $v) => $q->where('sector_id', $v))
            ->when($filters['street_id'] ?? null, fn ($q, $v) => $q->where('street_id', $v))
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->where('occupancy_status', $v))
            ->when($filters['q'] ?? null, fn ($q, $v) => $q->where('unit_code', 'like', "%{$v}%"));
    }
}
