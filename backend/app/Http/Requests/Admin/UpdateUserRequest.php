<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return (bool) $this->user()?->hasPermission('users.manage');
    }

    public function rules(): array
    {
        $userId = $this->route('user')?->id;

        return [
            'name' => ['sometimes', 'string', 'min:2', 'max:120', "regex:/^[\pL\s\-'.]+$/u"],
            'phone' => ['sometimes', 'nullable', 'string', 'regex:/^\+234\d{10}$/', Rule::unique('users', 'phone')->ignore($userId)],
            'role' => ['sometimes', Rule::in(array_keys(config('rbac.roles')))],
        ];
    }
}
