<?php

use App\Http\Controllers\Api\V1\Admin;
use App\Http\Controllers\Api\V1\Agent;
use App\Http\Controllers\Api\V1\Auth;
use App\Http\Controllers\Api\V1\Estate\EstateController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\Public;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| PAHE REST API — /api/v1
|--------------------------------------------------------------------------
| Every protected route requires a Sanctum session (auth:sanctum), an active
| account (active) and an explicit permission (permission:<code>). Row-level
| scope (own listings) is enforced in the controllers/services.
*/

Route::prefix('v1')->middleware('throttle:api')->group(function () {

    // ---------------------------------------------------------------- public
    Route::prefix('public')->group(function () {
        Route::get('estate', [Public\ListingController::class, 'estate']);
        Route::get('listings', [Public\ListingController::class, 'index']);
        Route::get('listings/featured', [Public\ListingController::class, 'featured']);
        Route::get('listings/{slug}', [Public\ListingController::class, 'show']);
        Route::post('listings/{id}/enquiries', [Public\ListingController::class, 'enquire'])->whereNumber('id')->middleware('throttle:enquiries');
        Route::post('listings/{id}/contact-reveal', [Public\ListingController::class, 'revealContact'])->whereNumber('id')->middleware('throttle:public-forms');
        Route::get('sitemap-listings.xml', [Public\ListingController::class, 'sitemap']);
        Route::get('units/lookup', [EstateController::class, 'lookup'])->middleware('throttle:30,1');
    });

    // ---------------------------------------------------------------- auth
    Route::prefix('auth')->group(function () {
        Route::post('login', [Auth\AuthController::class, 'login'])->middleware('throttle:login');
        Route::post('password/forgot', [Auth\PasswordResetController::class, 'forgot'])->middleware('throttle:public-forms');
        Route::post('password/reset', [Auth\PasswordResetController::class, 'reset'])->middleware('throttle:public-forms');
        Route::post('access-requests', [Auth\AccessRequestController::class, 'store'])->middleware('throttle:public-forms');
        Route::post('agent-applications', [Auth\AgentApplicationController::class, 'store'])->middleware('throttle:public-forms');

        Route::middleware(['auth:sanctum', 'active'])->group(function () {
            Route::get('session', [Auth\AuthController::class, 'session']);
            Route::post('logout', [Auth\AuthController::class, 'logout']);
            Route::post('password/change', [Auth\AuthController::class, 'changePassword']);
        });
    });

    // ---------------------------------------------------------------- authenticated
    Route::middleware(['auth:sanctum', 'active'])->group(function () {

        Route::get('notifications', [NotificationController::class, 'index']);
        Route::post('notifications/read-all', [NotificationController::class, 'markAllRead']);
        Route::post('notifications/{id}/read', [NotificationController::class, 'markRead']);

        // M04 estate registry (read for estate.view, write for estate.manage)
        Route::middleware('permission:estate.view|estate.manage')->group(function () {
            Route::get('sectors', [EstateController::class, 'sectors']);
            Route::get('streets', [EstateController::class, 'streets']);
            Route::get('units', [EstateController::class, 'units']);
        });
        Route::middleware('permission:estate.manage')->group(function () {
            Route::post('sectors', [EstateController::class, 'storeSector']);
            Route::post('streets', [EstateController::class, 'storeStreet']);
            Route::post('units', [EstateController::class, 'storeUnit']);
            Route::patch('units/{unit}', [EstateController::class, 'updateUnit']);
        });

        // M16 agent portal — own listings only
        Route::prefix('agent')->middleware('permission:listings.manage_own')->group(function () {
            Route::get('dashboard', [Agent\PortalController::class, 'dashboard']);
            Route::get('profile', [Agent\PortalController::class, 'profile']);
            Route::patch('profile', [Agent\PortalController::class, 'updateProfile']);
            Route::get('enquiries', [Agent\PortalController::class, 'enquiries']);
            Route::patch('enquiries/{id}', [Agent\PortalController::class, 'updateEnquiry'])->whereNumber('id');

            Route::get('listings', [Agent\ListingController::class, 'index']);
            Route::post('listings', [Agent\ListingController::class, 'store']);
            Route::get('listings/{id}', [Agent\ListingController::class, 'show'])->whereNumber('id');
            // Multipart edits (owner authorisation file) use POST with _method=PATCH (Laravel method spoofing).
            Route::patch('listings/{id}', [Agent\ListingController::class, 'update'])->whereNumber('id');
            Route::delete('listings/{id}', [Agent\ListingController::class, 'destroy'])->whereNumber('id');
            Route::post('listings/{id}/submit', [Agent\ListingController::class, 'submit'])->whereNumber('id');
            Route::post('listings/{id}/mark-closed', [Agent\ListingController::class, 'markClosed'])->whereNumber('id');
            Route::post('listings/{id}/renew', [Agent\ListingController::class, 'renew'])->whereNumber('id');
            Route::get('listings/{id}/history', [Agent\ListingController::class, 'history'])->whereNumber('id');
            Route::post('listings/{id}/media', [Agent\ListingController::class, 'uploadPhotos'])->whereNumber('id');
            Route::put('listings/{id}/media/order', [Agent\ListingController::class, 'reorderPhotos'])->whereNumber('id');
            Route::delete('listings/{id}/media/{media}', [Agent\ListingController::class, 'deletePhoto'])->whereNumber('id');
        });

        // ------------------------------------------------------------ administration
        Route::prefix('admin')->group(function () {
            Route::get('dashboard', Admin\DashboardController::class)->middleware('permission:dashboard.admin');
            Route::get('audit-logs', [Admin\AuditLogController::class, 'index'])->middleware('permission:audit.view');

            // M12 users
            Route::get('roles', [Admin\UserController::class, 'roles'])->middleware('permission:users.view');
            Route::get('users', [Admin\UserController::class, 'index'])->middleware('permission:users.view');
            Route::get('users/{user}', [Admin\UserController::class, 'show'])->middleware('permission:users.view');
            Route::post('users', [Admin\UserController::class, 'store'])->middleware('permission:users.manage');
            Route::patch('users/{user}', [Admin\UserController::class, 'update'])->middleware('permission:users.manage');
            Route::delete('users/{user}', [Admin\UserController::class, 'destroy'])->middleware('permission:users.manage');
            Route::post('users/{user}/invite', [Admin\UserController::class, 'resendInvitation'])->middleware('permission:users.manage');
            Route::post('users/{user}/block', [Admin\UserController::class, 'block'])->middleware('permission:users.block');
            Route::post('users/{user}/unblock', [Admin\UserController::class, 'unblock'])->middleware('permission:users.block');

            // M12 resident access requests
            Route::get('access-requests', [Admin\AccessRequestController::class, 'index'])->middleware('permission:access_requests.view');
            Route::get('access-requests/{accessRequest}', [Admin\AccessRequestController::class, 'show'])->middleware('permission:access_requests.view');
            Route::get('access-requests/{accessRequest}/files/{kind}', [Admin\AccessRequestController::class, 'file'])->middleware('permission:access_requests.view');
            Route::middleware('permission:access_requests.decide')->group(function () {
                Route::post('access-requests/{accessRequest}/approve', [Admin\AccessRequestController::class, 'approve']);
                Route::post('access-requests/{accessRequest}/reject', [Admin\AccessRequestController::class, 'reject']);
                Route::post('access-requests/{accessRequest}/request-info', [Admin\AccessRequestController::class, 'requestInfo']);
            });

            // M16 agents
            Route::get('agents', [Admin\AgentController::class, 'index'])->middleware('permission:agents.view');
            Route::get('agents/{agent}/id-document', [Admin\AgentController::class, 'idDocument'])->middleware('permission:agents.view');
            Route::middleware('permission:agents.decide')->group(function () {
                Route::post('agents/{agent}/approve', [Admin\AgentController::class, 'approve']);
                Route::post('agents/{agent}/reject', [Admin\AgentController::class, 'reject']);
                Route::post('agents/{agent}/suspend', [Admin\AgentController::class, 'suspend']);
                Route::post('agents/{agent}/reinstate', [Admin\AgentController::class, 'reinstate']);
            });

            // M16 listing approvals
            Route::middleware('permission:listings.review')->group(function () {
                Route::get('listings/options', [Admin\ListingController::class, 'options']);
                Route::get('listings', [Admin\ListingController::class, 'index']);
                Route::get('listings/{id}', [Admin\ListingController::class, 'show'])->whereNumber('id');
                Route::get('listings/{id}/owner-authorisation', [Admin\ListingController::class, 'ownerAuthorisation'])->whereNumber('id');
            });
            Route::middleware('permission:listings.approve')->group(function () {
                Route::post('listings/{id}/approve', [Admin\ListingController::class, 'approve'])->whereNumber('id');
                Route::post('listings/{id}/reject', [Admin\ListingController::class, 'reject'])->whereNumber('id');
                Route::post('listings/{id}/withdraw', [Admin\ListingController::class, 'withdraw'])->whereNumber('id');
            });
            Route::middleware('permission:listings.edit_any')->group(function () {
                Route::patch('listings/{id}', [Admin\ListingController::class, 'update'])->whereNumber('id');
                Route::post('listings/{id}/media', [Admin\ListingController::class, 'uploadPhotos'])->whereNumber('id');
                Route::delete('listings/{id}/media/{media}', [Admin\ListingController::class, 'deletePhoto'])->whereNumber('id');
            });
            Route::delete('listings/{id}', [Admin\ListingController::class, 'destroy'])->whereNumber('id')->middleware('permission:listings.delete_any');
            Route::post('listings/{id}/restore', [Admin\ListingController::class, 'restore'])->whereNumber('id')->middleware('permission:listings.restore');
            Route::post('listings/{id}/feature', [Admin\ListingController::class, 'feature'])->whereNumber('id')->middleware('permission:listings.feature');
        });
    });
});
