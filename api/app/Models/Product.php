<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Product extends Model
{
    protected $fillable = ['store_id', 'name', 'description', 'price', 'stock', 'image_path', 'is_active'];

    protected function casts(): array
    {
        return ['price' => 'decimal:2', 'stock' => 'integer', 'is_active' => 'boolean'];
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }
}
