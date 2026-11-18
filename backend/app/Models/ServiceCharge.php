<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ServiceCharge extends Model
{
    protected $fillable = ['name', 'category', 'fee_kobo', 'frequency', 'is_active'];
    protected $casts = ['is_active' => 'boolean'];
}
