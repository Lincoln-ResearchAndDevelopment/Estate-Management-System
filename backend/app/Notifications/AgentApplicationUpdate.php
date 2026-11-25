<?php

namespace App\Notifications;

use App\Models\AgentProfile;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * N46: agent application submitted (to EM/SA, event "submitted") or decided (to the applicant:
 * "approved", "rejected", "suspended", "reinstated").
 */
class AgentApplicationUpdate extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly AgentProfile $profile, private readonly string $event, private readonly ?string $reason = null) {}

    public function via(object $notifiable): array
    {
        return $this->event === 'submitted' ? ['database', 'mail'] : ['mail'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'New agent application',
            'body' => $this->profile->user?->name.($this->profile->agency_name ? ' — '.$this->profile->agency_name : ''),
            'link' => '/admin/agents',
            'category' => 'approvals',
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = new MailMessage;

        return match ($this->event) {
            'submitted' => $mail->subject('New agent application: '.$this->profile->user?->name)
                ->line('A property agent has applied for an account.')
                ->action('Review applications', config('estate.frontend_url').'/admin/agents'),
            'approved', 'reinstated' => $mail->subject('Your agent account is active')
                ->line('You can now sign in and list properties on the '.config('estate.name').' website.')
                ->action('Sign in', config('estate.frontend_url').'/login'),
            'suspended' => $mail->subject('Your agent account has been suspended')
                ->line('Your listings have been removed from the website.')
                ->line('Reason: '.$this->reason),
            default => $mail->subject('Your agent application was not approved')
                ->line('Reason: '.$this->reason),
        };
    }
}
