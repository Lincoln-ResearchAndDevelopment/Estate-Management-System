<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{

    /** Allowed store-side transitions (WF-13). */
    public const TRANSITIONS = [
        'placed' => ['accepted', 'rejected'],
        'accepted' => ['ready', 'cancelled'],
        'ready' => ['delivered', 'cancelled'],
    ];

    protected $fillable = ['reference', 'store_id', 'buyer_user_id', 'household_id', 'status', 'total', 'payment_method', 'delivery_note', 'status_reason'];

    protected function casts(): array
    {
        return ['total' => 'decimal:2'];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'buyer_user_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }
}
