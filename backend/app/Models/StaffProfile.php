<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffProfile extends Model
{

    public const DEPARTMENTS = ['security', 'maintenance', 'sanitation', 'administration', 'other'];

    protected $fillable = ['staff_code', 'user_id', 'full_name', 'phone', 'email', 'job_title', 'department', 'employment_type', 'hired_on', 'status', 'notes'];

    protected function casts(): array
    {
        return ['hired_on' => 'date'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
