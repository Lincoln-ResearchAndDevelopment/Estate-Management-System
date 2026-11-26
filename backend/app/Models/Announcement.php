<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Announcement extends Model
{
    protected $fillable = ['title', 'body', 'audience', 'pinned', 'published_by', 'published_at', 'expires_at'];

    protected function casts(): array
    {
        return ['pinned' => 'boolean', 'published_at' => 'datetime', 'expires_at' => 'datetime'];
    }

    public function publisher(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by');
    }
}
