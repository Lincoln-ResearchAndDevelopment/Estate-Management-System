<?php

namespace App\Notifications;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * N04/N05: invitation to set a password for an account created by estate management.
 */
class AccountInvitation extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly string $token) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(User $notifiable): MailMessage
    {
        $url = config('estate.frontend_url').'/reset-password?'.http_build_query([
            'token' => $this->token,
            'email' => $notifiable->email,
            'invite' => 1,
        ]);

        return (new MailMessage)
            ->subject('Your '.config('estate.short_name').' account is ready')
            ->greeting('Hello '.$notifiable->name.',')
            ->line('An account has been created for you on the '.config('estate.name').' portal.')
            ->action('Set your password', $url)
            ->line('This link expires in 60 minutes. If it has expired, use "Forgot password" on the sign-in page.');
    }
}
