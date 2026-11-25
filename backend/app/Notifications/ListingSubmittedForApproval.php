<?php

namespace App\Notifications;

use App\Models\PropertyListing;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** N47: listing submitted or resubmitted for approval (EM, SA). */
class ListingSubmittedForApproval extends Notification implements ShouldQueue
{
    use Queueable;

    /** @param list<string> $changedFields */
    public function __construct(private readonly PropertyListing $listing, private readonly array $changedFields = []) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => $this->changedFields ? 'Listing resubmitted for approval' : 'New listing awaiting approval',
            'body' => $this->listing->title.' ('.ucfirst($this->listing->listing_type).', ₦'.number_format((float) $this->listing->price_ngn).')',
            'changedFields' => $this->changedFields,
            'link' => '/admin/listings/'.$this->listing->id,
            'category' => 'listings',
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject('Listing awaiting approval: '.$this->listing->title)
            ->line('A property listing is waiting for your review.')
            ->line($this->listing->title.' — '.ucfirst($this->listing->listing_type).', ₦'.number_format((float) $this->listing->price_ngn));

        if ($this->changedFields) {
            $mail->line('Changed fields: '.implode(', ', str_replace('_', ' ', $this->changedFields)));
        }

        return $mail->action('Review listing', config('estate.frontend_url').'/admin/listings/'.$this->listing->id);
    }
}
