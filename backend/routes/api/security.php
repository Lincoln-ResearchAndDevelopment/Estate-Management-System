<?php

use App\Http\Controllers\Api\V1\Security\SecurityController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1/security')->middleware(['auth:sanctum', 'role:security|admin|super_admin|manager'])->group(function () {
    Route::get('emergency', [SecurityController::class, 'emergency']);
    Route::post('emergency/report', [SecurityController::class, 'reportIncident'])->middleware('throttle:20,1');

    Route::get('blacklist', [SecurityController::class, 'blacklist']);
    Route::post('blacklist', [SecurityController::class, 'addEntry']);
    Route::patch('blacklist/{id}', [SecurityController::class, 'updateEntry']);
});
