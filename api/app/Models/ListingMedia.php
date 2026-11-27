<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class ListingMedia extends Model
{
    protected $table = 'listing_media';

    protected $fillable = ['listing_id', 'path', 'media_type', 'is_cover', 'sort_order'];

    protected function casts(): array
    {
        return ['is_cover' => 'boolean', 'sort_order' => 'integer'];
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(PropertyListing::class, 'listing_id');
    }

    public function url(): string
    {
        return Storage::disk('public')->url($this->path);
    }
}
