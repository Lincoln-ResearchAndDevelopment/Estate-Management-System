<?php

namespace App\Enums;

enum UserStatus: string
{
    case Pending = 'pending';
    case Active = 'active';
    case Inactive = 'inactive';
    case Blocked = 'blocked';

    public function loginError(): ?string
    {
        return match ($this) {
            self::Active => null,
            self::Pending => 'Your account is awaiting approval.',
            self::Inactive => 'Your account has been deactivated. Contact estate management.',
            self::Blocked => 'Your account has been blocked. Contact estate management.',
        };
    }
}
