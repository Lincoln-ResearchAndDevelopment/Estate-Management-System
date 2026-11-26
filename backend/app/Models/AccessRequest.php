<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A prospective resident's request for portal access (WF-01). The NIN is encrypted at rest;
 * nin_hash (keyed HMAC) allows duplicate detection without decrypting.
 */
class AccessRequest extends Model
{
    public const RELATIONSHIPS = ['primary_resident', 'spouse', 'child', 'parent', 'relative', 'tenant', 'sub_tenant'];

    protected $fillable = [
        'reference', 'full_name', 'email', 'phone', 'relationship', 'unit_id', 'nin_encrypted', 'nin_hash',
        'password_hash', 'declarations', 'profile_photo_path', 'status', 'reviewed_by',
        'reviewed_at', 'decision_reason', 'created_user_id',
    ];

    protected $hidden = ['nin_encrypted', 'nin_hash', 'password_hash'];

    protected function casts(): array
    {
        return [
            'nin_encrypted' => 'encrypted',
            'declarations' => 'array',
            'reviewed_at' => 'datetime',
        ];
    }

    public static function hashNin(string $nin): string
    {
        return hash_hmac('sha256', preg_replace('/\D/', '', $nin), (string) config('app.key'));
    }

    public function unit(): BelongsTo
    {
        return $this->belongsTo(Unit::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function maskedNin(): string
    {
        $nin = (string) $this->nin_encrypted;

        return str_repeat('•', max(0, strlen($nin) - 4)).substr($nin, -4);
    }
}
