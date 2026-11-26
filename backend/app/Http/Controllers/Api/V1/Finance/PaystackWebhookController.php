<?php

namespace App\Http\Controllers\Api\V1\Finance;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Services\Finance\PaymentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaystackWebhookController extends Controller
{
    /** POST /webhooks/paystack — signature-checked, idempotent (WF-03). */
    public function __invoke(Request $request, PaymentService $payments): JsonResponse
    {
        $payments->handleWebhook($request->getContent(), $request->header('x-paystack-signature'));

        return response()->json(['received' => true]);
    }

    /** GET /public/receipts/{number} — anyone holding a receipt can check it is genuine. */
    public function verifyReceipt(string $number): JsonResponse
    {
        $payment = Payment::query()->with('household.unit')->where('receipt_number', $number)->where('status', 'success')->firstOrFail();

        return response()->json(['data' => [
            'receiptNumber' => $payment->receipt_number,
            'valid' => true,
            'amount' => ['amount' => number_format((float) $payment->amount, 2, '.', ''), 'currency' => 'NGN'],
            'paidAt' => $payment->paid_at?->toIso8601String(),
            'unit' => $payment->household?->unit?->unit_code,
            'estate' => config('estate.name'),
        ]]);
    }
}
