<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AccessLog extends Model
{
    protected $fillable = ['user_id', 'name', 'role_label', 'gate', 'verification_type', 'status', 'failure_reason', 'logged_by', 'occurred_at'];
    protected $casts = ['occurred_at' => 'datetime'];
}
