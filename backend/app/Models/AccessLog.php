<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccessLog extends Model
{
    public $timestamps = false;

    protected $fillable = ['subject_type', 'direction', 'visitor_pass_id', 'household_id', 'person_name', 'plate_number', 'gate', 'officer_id', 'flagged', 'flag_reason', 'note', 'occurred_at'];

    protected function casts(): array
    {
        return ['flagged' => 'boolean', 'occurred_at' => 'datetime'];
    }

    public function pass(): BelongsTo
    {
        return $this->belongsTo(VisitorPass::class, 'visitor_pass_id');
    }

    public function household(): BelongsTo
    {
        return $this->belongsTo(Household::class);
    }

    public function officer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'officer_id');
    }
}
