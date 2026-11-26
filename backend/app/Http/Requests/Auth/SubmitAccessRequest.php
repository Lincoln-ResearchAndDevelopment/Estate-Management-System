<?php

namespace App\Http\Requests\Auth;

use App\Models\AccessRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/** SCR-AUTH-02 field rules. */
class SubmitAccessRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['email' => strtolower(trim((string) $this->input('email')))]);
    }

    public function rules(): array
    {
        $imageKb = config('estate.uploads.image_max_kb');

        return [
            'full_name' => ['required', 'string', 'min:2', 'max:100', "regex:/^[\pL\s\-'.]+$/u"],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['required', 'string', 'regex:/^\+234\d{10}$/'],
            'relationship' => ['required', Rule::in(AccessRequest::RELATIONSHIPS)],
            'unit_id' => ['required', 'integer', Rule::exists('units', 'id')],
            'national_id' => ['required', 'string', 'regex:/^\d{11}$/'],
            'password' => ['required', 'confirmed', Password::min(8)->mixedCase()->numbers()->symbols()],
            'declaration_inside_estate' => ['accepted'],
            'declaration_info_correct' => ['accepted'],
            'declaration_agree_rules' => ['accepted'],
            'profile_photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png', "max:{$imageKb}"],
        ];
    }

    public function messages(): array
    {
        return [
            'phone.regex' => 'Enter a Nigerian mobile number in the format +234XXXXXXXXXX.',
            'national_id.regex' => 'The National Identification Number must be 11 digits.',
            'unit_id.exists' => 'This house number is not registered in the estate.',
        ];
    }
}
