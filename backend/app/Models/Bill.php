<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Bill extends Model
{

    public const OPEN = ['unpaid', 'part_paid', 'overdue'];

    public function balance(): float
    {
        return round((float) $this->amount - (float) $this->amount_paid, 2);
    }

    protected $fillable = ['reference', 'household_id', 'service_id', 'description', 'period_label', 'amount', 'amount_paid', 'due_date', 'status', 'created_by'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'amount_paid' => 'decimal:2', 'due_date' => 'date'];
    }

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(PaymentAllocation::class);
    }
}
