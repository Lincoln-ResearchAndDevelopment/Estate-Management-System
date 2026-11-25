<?php

namespace App\Notifications;

use App\Models\AccessRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** N01 (applicant): request received, awaiting approval. */
class AccessRequestReceived extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly AccessRequest $accessRequest) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('We received your access request ('.$this->accessRequest->reference.')')
            ->greeting('Hello '.$this->accessRequest->full_name.',')
            ->line('Your request for access to the '.config('estate.name').' resident portal has been submitted.')
            ->line('Reference: '.$this->accessRequest->reference)
            ->line('Estate management will review it and notify you by e-mail once a decision is made.');
    }
}
