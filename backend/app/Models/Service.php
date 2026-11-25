<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Service extends Model
{

    public const FREQUENCIES = ['monthly', 'quarterly', 'yearly', 'one_off'];

    protected $fillable = ['name', 'code', 'description', 'amount', 'frequency', 'applies_to', 'auto_bill', 'due_days', 'is_active'];

    protected function casts(): array
    {
        return ['amount' => 'decimal:2', 'auto_bill' => 'boolean', 'is_active' => 'boolean', 'due_days' => 'integer'];
    }

    public function households(): BelongsToMany
    {
        return $this->belongsToMany(Household::class, 'service_assignments');
    }

    public function bills(): HasMany
    {
        return $this->hasMany(Bill::class);
    }
}
