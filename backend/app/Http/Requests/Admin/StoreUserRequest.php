<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasPermission('users.manage');
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['email' => strtolower(trim((string) $this->input('email')))]);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:120', "regex:/^[\pL\s\-'.]+$/u"],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'phone' => ['nullable', 'string', 'regex:/^\+234\d{10}$/', Rule::unique('users', 'phone')],
            'role' => ['required', Rule::in(array_keys(config('rbac.roles')))],
        ];
    }

    public function messages(): array
    {
        return ['phone.regex' => 'Enter a Nigerian mobile number in the format +234XXXXXXXXXX.'];
    }
}
