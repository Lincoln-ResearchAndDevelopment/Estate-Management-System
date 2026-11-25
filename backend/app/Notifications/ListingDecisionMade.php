<?php

namespace App\Notifications;

use App\Models\PropertyListing;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** N48 / N49 / N51: listing approved, rejected, withdrawn, deleted by admin, or expired (to the agent). */
class ListingDecisionMade extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly PropertyListing $listing,
        private readonly string $decision,
        private readonly ?string $reason = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    private function headline(): string
    {
        return match ($this->decision) {
            'approved' => 'Your listing is live',
            'rejected' => 'Your listing was not approved',
            'withdrawn' => 'Approval of your listing was withdrawn',
            'deleted' => 'Your listing was removed by estate management',
            'expired' => 'Your listing has expired',
            default => 'Update on your listing',
        };
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => $this->headline(),
            'body' => $this->listing->title.($this->reason ? ' — '.$this->reason : ''),
            'link' => '/agent/listings/'.$this->listing->id,
            'category' => 'listings',
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)->subject($this->headline().': '.$this->listing->title)->line($this->headline().'.');

        if ($this->reason) {
            $mail->line('Reason: '.$this->reason);
        }

        return match ($this->decision) {
            'approved' => $mail->action('View public page', config('estate.frontend_url').'/listings/'.$this->listing->slug),
            'expired' => $mail->line('Relist it from your agent portal to submit it for approval again.')
                ->action('Open my listings', config('estate.frontend_url').'/agent/listings'),
            'deleted' => $mail,
            default => $mail->line('You can edit the listing and submit it again.')
                ->action('Edit listing', config('estate.frontend_url').'/agent/listings/'.$this->listing->id),
        };
    }
}
