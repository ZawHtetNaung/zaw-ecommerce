<?php

namespace App\Mail;

use App\Models\QuotationRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class QuotationRequestReceived extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public QuotationRequest $quotation)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            replyTo: [
                new \Illuminate\Mail\Mailables\Address(
                    $this->quotation->email,
                    $this->quotation->customer_name
                ),
            ],
            subject: "Quotation request {$this->quotation->reference}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.quotation-request',
        );
    }
}
