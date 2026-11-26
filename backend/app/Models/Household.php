<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Household extends Model
{
    protected $fillable = ['unit_id', 'head_user_id', 'tenant_access', 'guest_auto_approve', 'service_entry'];

    protected function casts(): array
    {
        return ['tenant_access' => 'boolean', 'guest_auto_approve' => 'boolean', 'service_entry' => 'boolean'];
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function head(): BelongsTo
    {
        return $this->belongsTo(User::class, 'head_user_id');
    }

    public function residents(): HasMany
    {
        return $this->hasMany(Resident::class);
    }

    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class);
    }

    public function bills(): HasMany
    {
        return $this->hasMany(Bill::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function passes(): HasMany
    {
        return $this->hasMany(VisitorPass::class);
    }

    /** Outstanding balance across open bills. */
    public function balance(): float
    {
        return round((float) $this->bills()->whereIn('status', Bill::OPEN)->sum(\Illuminate\Support\Facades\DB::raw('amount - amount_paid')), 2);
    }
}
