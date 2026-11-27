<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * In-app (and optionally e-mail) notification used by the operational modules (SRS 11.2–11.4):
 * bills, payments, alerts, passes, orders, notices. One class keeps templates consistent.
 */
class GenericNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly string $title,
        public readonly ?string $body = null,
        public readonly ?string $link = null,
        public readonly string $category = 'general',
        public readonly bool $email = false,
    ) {}

    public function via(object $notifiable): array
    {
        return $this->email ? ['database', 'mail'] : ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return ['title' => $this->title, 'body' => $this->body, 'link' => $this->link, 'category' => $this->category];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)->subject($this->title)->line($this->title);
        if ($this->body) {
            $mail->line($this->body);
        }
        if ($this->link) {
            $mail->action('Open', config('estate.frontend_url').$this->link);
        }

        return $mail;
    }
}
