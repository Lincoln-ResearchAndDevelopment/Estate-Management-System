<?php

namespace App\Support;

use App\Models\AccessLog;
use App\Models\Bill;
use App\Models\BlacklistEntry;
use App\Models\EmergencyAlert;
use App\Models\IncidentReport;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\StaffProfile;
use App\Models\Store;
use App\Models\Vehicle;
use App\Models\VisitorPass;
use Illuminate\Support\Facades\Storage;

/**
 * camelCase JSON presenters for the operational modules, so every endpoint returns the same shape
 * for the same record. Callers eager-load the relations they need.
 */
class Present
{
    public static function money($amount): array
    {
        return ['amount' => number_format((float) $amount, 2, '.', ''), 'currency' => 'NGN'];
    }

    public static function bill(Bill $b): array
    {
        return [
            'id' => $b->id,
            'reference' => $b->reference,
            'description' => $b->description,
            'periodLabel' => $b->period_label,
            'amount' => self::money($b->amount),
            'amountPaid' => self::money($b->amount_paid),
            'balance' => self::money($b->balance()),
            'dueDate' => $b->due_date?->toDateString(),
            'status' => $b->status,
            'service' => $b->relationLoaded('service') && $b->service ? ['id' => $b->service->id, 'name' => $b->service->name] : null,
            'unit' => $b->relationLoaded('household') ? $b->household?->unit?->unit_code : null,
            'createdAt' => $b->created_at?->toIso8601String(),
        ];
    }

    public static function payment(Payment $p): array
    {
        return [
            'id' => $p->id,
            'reference' => $p->reference,
            'receiptNumber' => $p->receipt_number,
            'amount' => self::money($p->amount),
            'method' => $p->method,
            'status' => $p->status,
            'payer' => $p->relationLoaded('user') ? $p->user?->name : null,
            'unit' => $p->relationLoaded('household') ? $p->household?->unit?->unit_code : null,
            'note' => $p->note,
            'rejectionReason' => $p->rejection_reason,
            'hasProof' => (bool) $p->proof_path,
            'proofUrl' => $p->proof_path ? url("/api/v1/finance/payments/{$p->id}/proof") : null,
            'allocations' => $p->relationLoaded('allocations') ? $p->allocations->map(fn ($a) => [
                'billId' => $a->bill_id,
                'description' => $a->relationLoaded('bill') ? $a->bill?->description : null,
                'amount' => self::money($a->amount),
            ])->values() : [],
            'verifiedBy' => $p->relationLoaded('verifier') ? $p->verifier?->name : null,
            'paidAt' => $p->paid_at?->toIso8601String(),
            'createdAt' => $p->created_at?->toIso8601String(),
        ];
    }

    public static function vehicle(Vehicle $v): array
    {
        return ['id' => $v->id, 'plateNumber' => $v->plate_number, 'make' => $v->make, 'model' => $v->model, 'colour' => $v->colour, 'stickerNumber' => $v->sticker_number, 'status' => $v->status];
    }

    public static function alert(EmergencyAlert $a): array
    {
        return [
            'id' => $a->id,
            'reference' => $a->reference,
            'type' => $a->type,
            'status' => $a->status,
            'description' => $a->description,
            'lat' => $a->lat,
            'lng' => $a->lng,
            'raisedBy' => $a->relationLoaded('raiser') ? ['id' => $a->raiser?->id, 'name' => $a->raiser?->name, 'phone' => $a->raiser?->phone] : null,
            'unit' => $a->relationLoaded('unit') ? $a->unit?->unit_code : null,
            'responder' => $a->relationLoaded('responder') ? $a->responder?->name : null,
            'resolutionNote' => $a->resolution_note,
            'escalated' => $a->escalated_at !== null,
            'acknowledgedAt' => $a->acknowledged_at?->toIso8601String(),
            'dispatchedAt' => $a->dispatched_at?->toIso8601String(),
            'resolvedAt' => $a->resolved_at?->toIso8601String(),
            'createdAt' => $a->created_at?->toIso8601String(),
            'events' => $a->relationLoaded('events') ? $a->events->sortBy('id')->map(fn ($e) => [
                'from' => $e->from_status, 'to' => $e->to_status, 'note' => $e->note,
                'actor' => $e->relationLoaded('actor') ? $e->actor?->name : null,
                'occurredAt' => $e->occurred_at?->toIso8601String(),
            ])->values() : [],
        ];
    }

    public static function incident(IncidentReport $r): array
    {
        return [
            'id' => $r->id,
            'reference' => $r->reference,
            'title' => $r->title,
            'category' => $r->category,
            'severity' => $r->severity,
            'location' => $r->location,
            'description' => $r->description,
            'status' => $r->status,
            'reportedBy' => $r->relationLoaded('reporter') ? $r->reporter?->name : null,
            'assignedTo' => $r->relationLoaded('assignee') && $r->assignee ? ['id' => $r->assignee->id, 'name' => $r->assignee->name] : null,
            'notes' => $r->relationLoaded('notes') ? $r->notes->sortBy('id')->map(fn ($n) => ['id' => $n->id, 'body' => $n->body, 'author' => $n->user?->name, 'createdAt' => $n->created_at?->toIso8601String()])->values() : [],
            'createdAt' => $r->created_at?->toIso8601String(),
            'closedAt' => $r->closed_at?->toIso8601String(),
        ];
    }

    public static function pass(VisitorPass $p): array
    {
        return [
            'id' => $p->id,
            'code' => $p->code,
            'visitorName' => $p->visitor_name,
            'visitorPhone' => $p->visitor_phone,
            'purpose' => $p->purpose,
            'vehiclePlate' => $p->vehicle_plate,
            'validFrom' => $p->valid_from?->toIso8601String(),
            'validUntil' => $p->valid_until?->toIso8601String(),
            'maxEntries' => $p->max_entries,
            'entriesUsed' => $p->entries_used,
            'status' => $p->status === 'active' && $p->valid_until?->isPast() ? 'expired' : $p->status,
            'unit' => $p->relationLoaded('household') ? $p->household?->unit?->unit_code : null,
            'host' => $p->relationLoaded('creator') ? $p->creator?->name : null,
            // QR code content and a link the resident can send to the visitor (opens the QR on their phone).
            'qrPayload' => $p->qr_token ? QrPayload::visitor($p->qr_token) : null,
            'shareUrl' => $p->qr_token ? config('estate.frontend_url').'/pass/'.$p->qr_token : null,
            'createdAt' => $p->created_at?->toIso8601String(),
        ];
    }

    public static function accessLog(AccessLog $l): array
    {
        return [
            'id' => $l->id,
            'subjectType' => $l->subject_type,
            'direction' => $l->direction,
            'personName' => $l->person_name,
            'plateNumber' => $l->plate_number,
            'gate' => $l->gate,
            'unit' => $l->relationLoaded('household') ? $l->household?->unit?->unit_code : null,
            'passCode' => $l->relationLoaded('pass') ? $l->pass?->code : null,
            'officer' => $l->relationLoaded('officer') ? $l->officer?->name : null,
            'flagged' => $l->flagged,
            'flagReason' => $l->flag_reason,
            'note' => $l->note,
            'occurredAt' => $l->occurred_at?->toIso8601String(),
        ];
    }

    public static function blacklist(BlacklistEntry $b): array
    {
        return [
            'id' => $b->id,
            'list' => $b->list,
            'subjectType' => $b->subject_type,
            'fullName' => $b->full_name,
            'phone' => $b->phone,
            'plateNumber' => $b->plate_number,
            'reason' => $b->reason,
            'status' => $b->status,
            'addedBy' => $b->relationLoaded('addedBy') ? $b->addedBy?->name : null,
            'clearedReason' => $b->cleared_reason,
            'clearedAt' => $b->cleared_at?->toIso8601String(),
            'createdAt' => $b->created_at?->toIso8601String(),
        ];
    }

    public static function staff(StaffProfile $s): array
    {
        return [
            'id' => $s->id,
            'staffCode' => $s->staff_code,
            'fullName' => $s->full_name,
            'phone' => $s->phone,
            'email' => $s->email,
            'jobTitle' => $s->job_title,
            'department' => $s->department,
            'employmentType' => $s->employment_type,
            'hiredOn' => $s->hired_on?->toDateString(),
            'status' => $s->status,
            'notes' => $s->notes,
            'hasLogin' => $s->user_id !== null,
            'createdAt' => $s->created_at?->toIso8601String(),
        ];
    }

    public static function store(Store $s): array
    {
        return [
            'id' => $s->id,
            'name' => $s->name,
            'slug' => $s->slug,
            'category' => $s->category,
            'description' => $s->description,
            'phone' => $s->phone,
            'location' => $s->location,
            'logoUrl' => $s->logo_path ? Storage::disk('public')->url($s->logo_path) : null,
            'status' => $s->status,
            'plan' => $s->plan,
            'decisionReason' => $s->decision_reason,
            'owner' => $s->relationLoaded('owner') ? $s->owner?->name : null,
            'productsCount' => $s->products_count ?? null,
            'createdAt' => $s->created_at?->toIso8601String(),
        ];
    }

    public static function product(Product $p): array
    {
        return [
            'id' => $p->id,
            'storeId' => $p->store_id,
            'name' => $p->name,
            'description' => $p->description,
            'price' => self::money($p->price),
            'stock' => $p->stock,
            'imageUrl' => $p->image_path ? Storage::disk('public')->url($p->image_path) : null,
            'isActive' => $p->is_active,
        ];
    }

    public static function order(Order $o): array
    {
        return [
            'id' => $o->id,
            'reference' => $o->reference,
            'status' => $o->status,
            'total' => self::money($o->total),
            'paymentMethod' => $o->payment_method,
            'deliveryNote' => $o->delivery_note,
            'statusReason' => $o->status_reason,
            'store' => $o->relationLoaded('store') ? ['id' => $o->store?->id, 'name' => $o->store?->name, 'phone' => $o->store?->phone] : null,
            'buyer' => $o->relationLoaded('buyer') ? ['name' => $o->buyer?->name, 'phone' => $o->buyer?->phone] : null,
            'items' => $o->relationLoaded('items') ? $o->items->map(fn ($i) => ['name' => $i->name, 'quantity' => $i->quantity, 'unitPrice' => self::money($i->unit_price), 'lineTotal' => self::money($i->line_total)])->values() : [],
            'createdAt' => $o->created_at?->toIso8601String(),
        ];
    }
}
