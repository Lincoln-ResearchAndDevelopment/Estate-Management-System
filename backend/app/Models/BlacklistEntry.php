<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BlacklistEntry extends Model
{
    protected $fillable = ['list', 'subject_type', 'full_name', 'phone', 'plate_number', 'reason', 'status', 'added_by', 'cleared_by', 'cleared_at', 'cleared_reason'];

    protected function casts(): array
    {
        return ['cleared_at' => 'datetime'];
    }

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }

    public function clearedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cleared_by');
    }
}
