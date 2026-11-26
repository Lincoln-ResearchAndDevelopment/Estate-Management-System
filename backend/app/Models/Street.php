<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Street extends Model
{
    use HasFactory;

    protected $fillable = ['sector_id', 'name'];

    public function sector(): BelongsTo
    {
        return $this->belongsTo(Sector::class);
    }

    public function units(): HasMany
    {
        return $this->hasMany(Unit::class);
    }
}
