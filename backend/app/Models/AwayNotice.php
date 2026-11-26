<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AwayNotice extends Model
{
    protected $fillable = ['household_id', 'created_by', 'from_date', 'to_date', 'note', 'emergency_contact', 'status'];

    protected function casts(): array
    {
        return ['from_date' => 'date', 'to_date' => 'date'];
    }

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
