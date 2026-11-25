<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Vehicle extends Model
{
    protected $fillable = ['household_id', 'added_by', 'plate_number', 'make', 'model', 'colour', 'sticker_number', 'status'];

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }
}
