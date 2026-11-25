<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AgentProfile extends Model
{
    protected $fillable = [
        'user_id', 'agency_name', 'agency_reg_no', 'id_document_path', 'bio', 'status', 'verified',
        'approved_by', 'approved_at', 'decision_reason',
    ];

    protected function casts(): array
    {
        return ['verified' => 'boolean', 'approved_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
