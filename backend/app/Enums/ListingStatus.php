<?php

namespace App\Enums;

/**
 * Listing status model (SRS Section 6.16 and WF-20). Nothing is public unless Approved.
 */
enum ListingStatus: string
{
    case Draft = 'draft';
    case PendingApproval = 'pending_approval';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case ApprovalWithdrawn = 'approval_withdrawn';
    case RentedSold = 'rented_sold';
    case Expired = 'expired';
    case Deleted = 'deleted';

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::PendingApproval => 'Pending Approval',
            self::Approved => 'Live',
            self::Rejected => 'Rejected',
            self::ApprovalWithdrawn => 'Approval Withdrawn',
            self::RentedSold => 'Rented / Sold',
            self::Expired => 'Expired',
            self::Deleted => 'Deleted',
        };
    }

    /** Statuses from which an agent may submit or resubmit for approval. */
    public function canSubmit(): bool
    {
        return in_array($this, [self::Draft, self::Rejected, self::ApprovalWithdrawn, self::Expired, self::RentedSold], true);
    }
}
