<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Payment extends Model
{
    protected $fillable = ['reference', 'household_id', 'user_id', 'amount', 'method', 'status', 'gateway_reference', 'gateway_payload', 'proof_path', 'receipt_number', 'note', 'verified_by', 'verified_at', 'rejection_reason', 'paid_at'];

    protected $hidden = ['gateway_payload'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'gateway_payload' => 'array', 'verified_at' => 'datetime', 'paid_at' => 'datetime'];
    }

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class);
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }
}
