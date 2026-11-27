<?php

namespace App\Models;

use App\Enums\ListingStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class PropertyListing extends Model
{
    use HasFactory, SoftDeletes;

    /** Fields an agent may edit; changes to these on a live listing send it back for approval. */
    public const EDITABLE = [
        'listing_type', 'property_type', 'title', 'description', 'unit_id', 'sector_id', 'street_id',
        'show_unit_number', 'bedrooms', 'bathrooms', 'toilets', 'size_sqm', 'furnishing', 'price_ngn',
        'price_period', 'negotiable', 'service_charge_ngn', 'caution_fee_ngn', 'agency_fee_ngn',
        'available_from', 'amenities', 'video_url',
    ];

    protected $fillable = [
        ...self::EDITABLE,
        'listing_code', 'slug', 'agent_user_id', 'owner_auth_path', 'status', 'is_featured', 'submitted_at',
        'approved_at', 'approved_by', 'published_until', 'last_decision_reason', 'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'status' => ListingStatus::class,
            'amenities' => 'array',
            'show_unit_number' => 'boolean',
            'negotiable' => 'boolean',
            'is_featured' => 'boolean',
            'price_ngn' => 'decimal:2',
            'service_charge_ngn' => 'decimal:2',
            'caution_fee_ngn' => 'decimal:2',
            'agency_fee_ngn' => 'decimal:2',
            'size_sqm' => 'decimal:2',
            'available_from' => 'date',
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
            'published_until' => 'datetime',
        ];
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_user_id');
    }

    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }

    public function street(): BelongsTo
    {
        return $this->belongsTo(Street::class);
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function media(): HasMany
    {
        return $this->hasMany(ListingMedia::class, 'listing_id')->orderBy('sort_order');
    }

    public function photos(): HasMany
    {
        return $this->media()->where('media_type', 'photo');
    }

    public function cover(): HasOne
    {
        return $this->hasOne(ListingMedia::class, 'listing_id')->where('is_cover', true);
    }

    public function history(): HasMany
    {
        return $this->hasMany(ListingStatusHistory::class, 'listing_id')->latest('occurred_at')->latest('id');
    }

    public function enquiries(): HasMany
    {
        return $this->hasMany(ListingEnquiry::class, 'listing_id');
    }

    /** Listings the public may see: approved, not deleted, not past their publish window. */
    public function scopePubliclyVisible(Builder $query): Builder
    {
        return $query->where('status', ListingStatus::Approved)
            ->where(fn (Builder $q) => $q->whereNull('published_until')->orWhere('published_until', '>', now()));
    }

    public function scopeFilter(Builder $query, array $filters): Builder
    {
        return $query
            ->when($filters['type'] ?? null, fn ($q, $v) => $q->where('listing_type', $v))
            ->when($filters['property_type'] ?? null, fn ($q, $v) => $q->where('property_type', $v))
            ->when($filters['bedrooms'] ?? null, fn ($q, $v) => (int) $v >= 5 ? $q->where('bedrooms', '>=', 5) : $q->where('bedrooms', (int) $v))
            ->when($filters['min_price'] ?? null, fn ($q, $v) => $q->where('price_ngn', '>=', $v))
            ->when($filters['max_price'] ?? null, fn ($q, $v) => $q->where('price_ngn', '<=', $v))
            ->when($filters['sector_id'] ?? null, fn ($q, $v) => $q->where('sector_id', $v))
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($filters['agent_id'] ?? null, fn ($q, $v) => $q->where('agent_user_id', $v))
            ->when($filters['q'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w
                ->where('title', 'like', "%{$v}%")
                ->orWhere('listing_code', 'like', "%{$v}%")));
    }

    public function scopeSorted(Builder $query, ?string $sort): Builder
    {
        return match ($sort) {
            'price_asc' => $query->orderBy('price_ngn')->orderByDesc('id'),
            'price_desc' => $query->orderByDesc('price_ngn')->orderByDesc('id'),
            default => $query->orderByDesc('approved_at')->orderByDesc('id'),
        };
    }

    public function isOwnedBy(User $user): bool
    {
        return (int) $this->agent_user_id === (int) $user->id;
    }
}
