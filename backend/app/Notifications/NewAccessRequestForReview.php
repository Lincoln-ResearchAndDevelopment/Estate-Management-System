<?php

namespace App\Notifications;

use App\Models\AccessRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** N01 (EM/SA): a new access request needs review. */
class NewAccessRequestForReview extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly AccessRequest $accessRequest) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'New access request',
            'body' => $this->accessRequest->full_name.' requested resident access.',
            'link' => '/admin/access-requests?selected='.$this->accessRequest->id,
            'category' => 'approvals',
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('New resident access request: '.$this->accessRequest->full_name)
            ->line($this->accessRequest->full_name.' ('.$this->accessRequest->email.') has requested resident access.')
            ->action('Review request', config('estate.frontend_url').'/admin/access-requests');
    }
}
