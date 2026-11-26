<?php

namespace App\Support;

/**
 * What the estate's QR codes contain. The token is random and unguessable (40 characters), so a QR code
 * cannot be forged from a unit number or a name. Short 6-character visitor codes remain valid for manual entry.
 */
final class QrPayload
{
    public const VISITOR = 'PAHE-V';

    public const RESIDENT = 'PAHE-R';

    public static function visitor(string $token): string
    {
        return self::VISITOR.':'.$token;
    }

    public static function resident(string $token): string
    {
        return self::RESIDENT.':'.$token;
    }

    /**
     * @return array{type: 'visitor'|'resident'|'code', value: string}
     */
    public static function parse(string $input): array
    {
        $input = trim($input);
        // A scanned share link (…/pass/<token>) is treated as the visitor token it carries.
        if (preg_match('#/pass/([A-Za-z0-9]{40})(?:[/?#].*)?$#', $input, $m)) {
            return ['type' => 'visitor', 'value' => $m[1]];
        }
        if (preg_match('/^(PAHE-[VR]):([A-Za-z0-9]{40})$/', $input, $m)) {
            return ['type' => $m[1] === self::VISITOR ? 'visitor' : 'resident', 'value' => $m[2]];
        }

        return ['type' => 'code', 'value' => strtoupper($input)];
    }
}
