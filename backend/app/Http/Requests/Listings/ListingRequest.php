<?php

namespace App\Http\Requests\Listings;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * SCR-LIST-06 Create / Edit Listing. POST requires every core field; PATCH accepts any subset.
 * Multipart: send amenities as amenities[] and booleans as 1/0.
 */
class ListingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';
        $isLand = $this->input('property_type', $this->route('listing')?->property_type) === 'land';
        $isRent = $this->input('listing_type', $this->route('listing')?->listing_type) === 'rent';
        $docKb = config('estate.uploads.document_max_kb');

        return [
            'title' => [$required, 'string', 'min:10', 'max:120'],
            'listing_type' => [$required, Rule::in(['rent', 'sale'])],
            'property_type' => [$required, Rule::in(array_keys(config('estate.listings.property_types')))],
            'description' => [$required, 'string', 'min:50', 'max:5000', 'not_regex:/(https?:\/\/|www\.)/i'],
            'unit_id' => ['nullable', 'integer', Rule::exists('units', 'id')],
            'sector_id' => [$required, 'integer', Rule::exists('sectors', 'id')],
            'street_id' => [$required, 'integer', Rule::exists('streets', 'id')->where('sector_id', $this->input('sector_id', $this->route('listing')?->sector_id))],
            'show_unit_number' => ['sometimes', 'boolean'],
            'bedrooms' => [$isLand ? 'nullable' : $required, 'nullable', 'integer', 'min:0', 'max:20'],
            'bathrooms' => [$isLand ? 'nullable' : $required, 'nullable', 'integer', 'min:0', 'max:20'],
            'toilets' => ['nullable', 'integer', 'min:0', 'max:20'],
            'size_sqm' => ['nullable', 'numeric', 'gt:0', 'max:1000000'],
            'furnishing' => ['nullable', Rule::in(['unfurnished', 'semi_furnished', 'furnished'])],
            'price_ngn' => [$required, 'numeric', 'gt:0', 'max:999999999999'],
            'price_period' => [$isRent ? $required : 'nullable', 'nullable', Rule::in(['year', 'month'])],
            'negotiable' => ['sometimes', 'boolean'],
            'service_charge_ngn' => ['nullable', 'numeric', 'min:0'],
            'caution_fee_ngn' => ['nullable', 'numeric', 'min:0'],
            'agency_fee_ngn' => ['nullable', 'numeric', 'min:0'],
            'available_from' => [$required, 'date', $this->isMethod('post') ? 'after_or_equal:today' : 'date'],
            'amenities' => ['nullable', 'array', 'max:30'],
            'amenities.*' => ['string', 'max:40'],
            'video_url' => ['nullable', 'url', 'regex:/^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//i'],
            'owner_authorisation' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', "max:{$docKb}"],
            'declaration' => [$this->boolean('submit') ? 'accepted' : 'nullable'],
            'submit' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'description.not_regex' => 'Do not include links in the description.',
            'video_url.regex' => 'Use a YouTube or Vimeo link.',
            'declaration.accepted' => 'Confirm that you are authorised to market this property.',
        ];
    }

    /** Validated listing attributes without files or control flags. */
    public function listingData(): array
    {
        $data = collect($this->validated())->except(['owner_authorisation', 'declaration', 'submit'])->all();

        if (($data['property_type'] ?? null) === 'land') {
            $data['bedrooms'] = $data['bathrooms'] = $data['toilets'] = null;
        }
        if (($data['listing_type'] ?? null) === 'sale') {
            $data['price_period'] = null;
        }

        return $data;
    }
}
