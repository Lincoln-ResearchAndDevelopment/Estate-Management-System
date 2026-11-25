<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ListingStatusHistory extends Model
{
    public $timestamps = false;

    protected $table = 'listing_status_history';

    protected $fillable = ['listing_id', 'from_status', 'to_status', 'actor_user_id', 'reason', 'changed_fields', 'occurred_at'];

    protected function casts(): array
    {
        return ['changed_fields' => 'array', 'occurred_at' => 'datetime'];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
