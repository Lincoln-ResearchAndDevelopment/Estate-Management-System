<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sector extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'code'];

    public function streets(): HasMany
    {
        return $this->hasMany(Street::class);
    }

    public function units(): HasMany
    {
        return $this->hasMany(Unit::class);
    }
}
