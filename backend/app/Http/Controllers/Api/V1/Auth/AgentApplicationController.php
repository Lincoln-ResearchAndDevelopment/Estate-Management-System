<?php

namespace App\Http\Controllers\Api\V1\Auth;

use App\Http\Controllers\Controller;
use App\Services\Listings\AgentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/** POST /auth/agent-applications — "Become an Agent" (SCR-LIST-10). */
class AgentApplicationController extends Controller
{
    public function store(Request $request, AgentService $agents): JsonResponse
    {
        $request->merge(['email' => strtolower(trim((string) $request->input('email')))]);
        $imageKb = config('estate.uploads.image_max_kb');
        $docKb = config('estate.uploads.document_max_kb');

        $data = $request->validate([
            'full_name' => ['required', 'string', 'min:2', 'max:100', "regex:/^[\pL\s\-'.]+$/u"],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'phone' => ['required', 'string', 'regex:/^\+234\d{10}$/', Rule::unique('users', 'phone')],
            'agency_name' => ['nullable', 'string', 'max:120'],
            'agency_reg_no' => ['nullable', 'string', 'max:60'],
            'id_document' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', "max:{$docKb}"],
            'profile_photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png', "max:{$imageKb}"],
            'password' => ['required', 'confirmed', Password::min(8)->mixedCase()->numbers()->symbols()],
            'accept_terms' => ['accepted'],
        ], [
            'phone.regex' => 'Enter a Nigerian mobile number in the format +234XXXXXXXXXX.',
            'email.unique' => 'An account with this email already exists.',
        ]);

        $agents->apply($data, $request->file('id_document'), $request->file('profile_photo'));

        return response()->json([
            'message' => 'Application received. Estate management will review it and e-mail you once approved.',
        ], 201);
    }
}
