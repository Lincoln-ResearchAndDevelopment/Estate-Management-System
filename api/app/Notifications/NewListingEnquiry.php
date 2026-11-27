<?php

namespace App\Notifications;

use App\Models\ListingEnquiry;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** N50: new enquiry on a listing (to the agent). SMS channel is added with the SMS provider (M13). */
class NewListingEnquiry extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly ListingEnquiry $enquiry) {}

    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'New enquiry from '.$this->enquiry->name,
            'body' => $this->enquiry->listing?->title,
            'link' => '/agent/enquiries?selected='.$this->enquiry->id,
            'category' => 'enquiries',
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('New enquiry: '.$this->enquiry->listing?->title)
            ->line($this->enquiry->name.' ('.$this->enquiry->phone.') sent an enquiry:')
            ->line('"'.$this->enquiry->message.'"')
            ->action('Open enquiries', config('estate.frontend_url').'/agent/enquiries');
    }
}
