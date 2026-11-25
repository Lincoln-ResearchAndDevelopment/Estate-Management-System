<?php

namespace Tests\Unit;

use App\Enums\ListingStatus;
use PHPUnit\Framework\TestCase;

class ListingStatusTest extends TestCase
{
    public function test_only_closed_or_unpublished_statuses_can_be_submitted(): void
    {
        $this->assertTrue(ListingStatus::Draft->canSubmit());
        $this->assertTrue(ListingStatus::Rejected->canSubmit());
        $this->assertTrue(ListingStatus::ApprovalWithdrawn->canSubmit());
        $this->assertFalse(ListingStatus::PendingApproval->canSubmit());
        $this->assertFalse(ListingStatus::Approved->canSubmit());
        $this->assertFalse(ListingStatus::Deleted->canSubmit());
    }

    public function test_approved_is_labelled_live(): void
    {
        $this->assertSame('Live', ListingStatus::Approved->label());
    }
}
