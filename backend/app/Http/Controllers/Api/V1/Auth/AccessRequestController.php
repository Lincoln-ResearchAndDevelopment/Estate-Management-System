<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\SubmitAccessRequest;
use App\Services\Users\AccessRequestService;
use Illuminate\Http\JsonResponse;

/** POST /auth/access-requests — public resident registration (multipart). */
class AccessRequestController extends Controller
{
    public function store(SubmitAccessRequest $request, AccessRequestService $service): JsonResponse
    {
        $accessRequest = $service->submit(
            $request->validated(),
            $request->file('profile_photo'),
            $request->file('face_capture'),
        );

        return response()->json([
            'data' => [
                'reference' => $accessRequest->reference,
                'status' => $accessRequest->status,
            ],
            'message' => 'Your request has been submitted. You will be notified once management approves it.',
        ], 201);
    }
}
