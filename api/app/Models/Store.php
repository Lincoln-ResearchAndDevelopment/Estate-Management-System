<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Store extends Model
{

    public const CATEGORIES = ['groceries', 'pharmacy', 'food', 'laundry', 'services', 'other'];

    protected $fillable = ['owner_user_id', 'name', 'slug', 'category', 'description', 'phone', 'location', 'logo_path', 'status', 'plan', 'decision_reason'];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
