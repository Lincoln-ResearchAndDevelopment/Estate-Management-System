<?php

namespace App\Notifications;

use App\Models\AccessRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** N02 / N03: access request approved, rejected or more information requested. */
class AccessRequestDecided extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly AccessRequest $accessRequest, private readonly string $decision) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)->greeting('Hello '.$this->accessRequest->full_name.',');

        return match ($this->decision) {
            'approved' => $mail->subject('Your resident access has been approved')
                ->line('Your access request ('.$this->accessRequest->reference.') has been approved.')
                ->action('Sign in', config('estate.frontend_url').'/login'),
            'info_requested' => $mail->subject('More information needed for your access request')
                ->line('Estate management needs more information before approving your request:')
                ->line($this->accessRequest->decision_reason)
                ->line('Please contact the estate management office.'),
            default => $mail->subject('Your access request was not approved')
                ->line('Your access request ('.$this->accessRequest->reference.') was not approved for this reason:')
                ->line($this->accessRequest->decision_reason)
                ->line('You may submit a new request once the issue is resolved.'),
        };
    }
}
