<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ListingEnquiry extends Model
{
    public const STATUSES = ['new', 'contacted', 'closed'];

    protected $fillable = [
        'listing_id', 'user_id', 'name', 'phone', 'email', 'message', 'preferred_viewing_date', 'status',
        'agent_note', 'ip_hash',
    ];

    protected $hidden = ['ip_hash'];

    protected function casts(): array
    {
        return ['preferred_viewing_date' => 'date'];
    }

    public function listing(): BelongsTo
    {
        return $this->belongsTo(PropertyListing::class, 'listing_id')->withTrashed();
    }
}
