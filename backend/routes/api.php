<?php

use App\Http\Controllers\Api\V1\Access\AccessController;
use App\Http\Controllers\Api\V1\Admin;
use App\Http\Controllers\Api\V1\Comms\CommsController;
use App\Http\Controllers\Api\V1\Finance\FinanceController;
use App\Http\Controllers\Api\V1\Finance\PaystackWebhookController;
use App\Http\Controllers\Api\V1\Market\MarketController;
use App\Http\Controllers\Api\V1\Reports\ReportsController;
use App\Http\Controllers\Api\V1\Resident\ResidentController;
use App\Http\Controllers\Api\V1\Resident\ResidentFinanceController;
use App\Http\Controllers\Api\V1\Security\SecurityController;
use App\Http\Controllers\Api\V1\Staff\StaffController;
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

// Paystack calls this server-to-server; authenticity is proven by the HMAC signature, not a session.
Route::post('v1/webhooks/paystack', PaystackWebhookController::class)->middleware('throttle:120,1');

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
        // Street names for listing forms and public filters (not sensitive).
        Route::get('streets', [EstateController::class, 'streets']);
        Route::get('receipts/{number}', [PaystackWebhookController::class, 'verifyReceipt'])->middleware('throttle:public-forms');
    });

    // ---------------------------------------------------------------- auth
    Route::prefix('auth')->group(function () {
        Route::post('login', [Auth\AuthController::class, 'login'])->middleware('throttle:login');
        Route::post('password/forgot', [Auth\PasswordResetController::class, 'forgot'])->middleware('throttle:public-forms');
        Route::post('password/reset', [Auth\PasswordResetController::class, 'reset'])->middleware('throttle:public-forms');
        Route::post('access-requests', [Auth\AccessRequestController::class, 'store'])->middleware('throttle:public-forms');
        Route::post('agent-applications', [Auth\AgentApplicationController::class, 'store'])->middleware('throttle:public-forms');
        Route::post('mfa/challenge', [Auth\AuthController::class, 'mfaChallenge'])->middleware('throttle:login');

        Route::middleware(['auth:sanctum', 'active'])->group(function () {
            Route::get('session', [Auth\AuthController::class, 'session']);
            Route::post('logout', [Auth\AuthController::class, 'logout']);
            Route::post('password/change', [Auth\AuthController::class, 'changePassword']);
            Route::post('mfa/setup', [Auth\AuthController::class, 'mfaSetup']);
            Route::post('mfa/enable', [Auth\AuthController::class, 'mfaEnable']);
            Route::post('mfa/disable', [Auth\AuthController::class, 'mfaDisable']);
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


        // ------------------------------------------------------------ M03 resident portal
        Route::prefix('resident')->group(function () {
            Route::get('dashboard', [ResidentController::class, 'dashboard'])->middleware('permission:finance.pay_own|household.manage_own|comms.use');
            Route::get('profile', [ResidentController::class, 'profile'])->middleware('permission:finance.pay_own|household.manage_own');
            Route::patch('profile', [ResidentController::class, 'updateProfile'])->middleware('permission:finance.pay_own|household.manage_own');
            Route::middleware('permission:household.manage_own')->group(function () {
                Route::post('household/members', [ResidentController::class, 'addMember']);
                Route::delete('household/members/{member}', [ResidentController::class, 'removeMember']);
                Route::post('vehicles', [ResidentController::class, 'addVehicle']);
                Route::delete('vehicles/{vehicle}', [ResidentController::class, 'removeVehicle']);
            });

            // M05 resident finance
            Route::middleware('permission:finance.pay_own')->group(function () {
                Route::get('finance', [ResidentFinanceController::class, 'summary']);
                Route::get('payments', [ResidentFinanceController::class, 'payments']);
                Route::post('payments/initialize', [ResidentFinanceController::class, 'initiate']);
                Route::get('payments/verify', [ResidentFinanceController::class, 'verify']);
                Route::post('payments/test-complete', [ResidentFinanceController::class, 'completeTest']);
                Route::post('payments/transfer', [ResidentFinanceController::class, 'transfer']);
                Route::get('receipts/{payment}', [ResidentFinanceController::class, 'receipt']);
            });

            // M08 panic / emergency
            Route::middleware('permission:alerts.raise')->group(function () {
                Route::post('alerts', [SecurityController::class, 'raise'])->middleware('throttle:10,1');
                Route::get('alerts', [SecurityController::class, 'myAlerts']);
                Route::post('alerts/{alert}/cancel', [SecurityController::class, 'cancel']);
            });

            // M09 visitor passes, activity and away notices
            Route::middleware('permission:access.manage_own')->group(function () {
                Route::get('passes', [AccessController::class, 'myPasses']);
                Route::post('passes', [AccessController::class, 'createPass']);
                Route::post('passes/{pass}/cancel', [AccessController::class, 'cancelPass']);
                Route::get('activity', [AccessController::class, 'myActivity']);
                Route::get('away', [AccessController::class, 'myAway']);
                Route::post('away', [AccessController::class, 'createAway']);
                Route::post('away/{notice}/cancel', [AccessController::class, 'cancelAway']);
            });
        });

        // ------------------------------------------------------------ M05 finance administration
        Route::prefix('finance')->group(function () {
            Route::middleware('permission:finance.view')->group(function () {
                Route::get('overview', [FinanceController::class, 'overview']);
                Route::get('services', [FinanceController::class, 'services']);
                Route::get('bills', [FinanceController::class, 'bills']);
                Route::get('payments', [FinanceController::class, 'paymentsIndex']);
                Route::get('payments/{payment}/proof', [FinanceController::class, 'proof']);
                Route::get('outstanding', [FinanceController::class, 'outstanding']);
                Route::get('households', [FinanceController::class, 'households']);
            });
            Route::middleware('permission:finance.manage')->group(function () {
                Route::post('services', [FinanceController::class, 'storeService']);
                Route::put('services/{service}', [FinanceController::class, 'updateService']);
                Route::post('services/{service}/bill-now', [FinanceController::class, 'billNow']);
                Route::post('bills', [FinanceController::class, 'issueBills']);
                Route::post('bills/{bill}/void', [FinanceController::class, 'voidBill']);
                Route::post('payments/record', [FinanceController::class, 'recordPayment']);
            });
            Route::middleware('permission:finance.verify')->group(function () {
                Route::post('payments/{payment}/verify', [FinanceController::class, 'verifyPayment']);
                Route::post('payments/{payment}/reject', [FinanceController::class, 'rejectPayment']);
            });
        });

        // ------------------------------------------------------------ M08 security console, M09 gate, M10 blacklist
        Route::prefix('security')->group(function () {
            Route::middleware('permission:security.respond')->group(function () {
                Route::get('overview', [SecurityController::class, 'overview']);
                Route::get('alerts', [SecurityController::class, 'alerts']);
                Route::get('alerts/{alert}', [SecurityController::class, 'showAlert']);
                Route::post('alerts/{alert}/transition', [SecurityController::class, 'transitionAlert']);
                Route::get('officers', [SecurityController::class, 'officers']);
            });
            Route::middleware('permission:security.reports')->group(function () {
                Route::get('incidents', [SecurityController::class, 'incidents']);
                Route::post('incidents', [SecurityController::class, 'storeIncident']);
                Route::get('incidents/{incident}', [SecurityController::class, 'showIncident']);
                Route::patch('incidents/{incident}', [SecurityController::class, 'updateIncident']);
                Route::post('incidents/{incident}/notes', [SecurityController::class, 'addNote']);
            });
            Route::middleware('permission:access.gate')->group(function () {
                Route::post('passes/verify', [AccessController::class, 'verifyPass']);
                Route::post('access-logs', [AccessController::class, 'record']);
            });
            Route::middleware('permission:access.view|access.gate')->group(function () {
                Route::get('access-logs', [AccessController::class, 'logs']);
                Route::get('inside', [AccessController::class, 'inside']);
                Route::get('away', [AccessController::class, 'awayNotices']);
            });
            Route::get('blacklist', [AccessController::class, 'blacklist'])->middleware('permission:blacklist.view');
            Route::middleware('permission:blacklist.manage')->group(function () {
                Route::post('blacklist', [AccessController::class, 'addBlacklist']);
                Route::post('blacklist/{entry}/clear', [AccessController::class, 'clearBlacklist']);
            });
        });

        // ------------------------------------------------------------ M11 staff
        Route::get('staff', [StaffController::class, 'index'])->middleware('permission:staff.view');
        Route::get('staff/{staff}', [StaffController::class, 'show'])->middleware('permission:staff.view');
        Route::middleware('permission:staff.manage')->group(function () {
            Route::post('staff', [StaffController::class, 'store']);
            Route::put('staff/{staff}', [StaffController::class, 'update']);
            Route::post('staff/{staff}/status', [StaffController::class, 'setStatus']);
            Route::delete('staff/{staff}', [StaffController::class, 'destroy']);
        });

        // ------------------------------------------------------------ M07 communication
        Route::middleware('permission:comms.use')->group(function () {
            Route::get('announcements', [CommsController::class, 'announcements']);
            Route::get('meetings', [CommsController::class, 'meetings']);
            Route::post('meetings/{meeting}/rsvp', [CommsController::class, 'rsvp']);
            Route::get('posts', [CommsController::class, 'posts']);
            Route::post('posts', [CommsController::class, 'storePost'])->middleware('throttle:20,1');
            Route::post('posts/{post}/comments', [CommsController::class, 'comment'])->middleware('throttle:30,1');
            Route::delete('posts/{post}', [CommsController::class, 'deletePost']);
            Route::get('conversations', [CommsController::class, 'conversations']);
            Route::post('conversations', [CommsController::class, 'startConversation'])->middleware('throttle:20,1');
            Route::get('conversations/{conversation}/messages', [CommsController::class, 'messages']);
            Route::post('conversations/{conversation}/messages', [CommsController::class, 'sendMessage'])->middleware('throttle:60,1');
            Route::get('contacts', [CommsController::class, 'contacts']);
        });
        Route::middleware('permission:comms.publish')->group(function () {
            Route::post('announcements', [CommsController::class, 'storeAnnouncement']);
            Route::delete('announcements/{announcement}', [CommsController::class, 'deleteAnnouncement']);
            Route::post('meetings', [CommsController::class, 'storeMeeting']);
            Route::patch('meetings/{meeting}', [CommsController::class, 'updateMeeting']);
        });
        Route::post('posts/{post}/moderate', [CommsController::class, 'moderate'])->middleware('permission:comms.moderate');

        // ------------------------------------------------------------ M06 marketplace
        Route::prefix('market')->middleware('permission:market.shop')->group(function () {
            Route::get('stores', [MarketController::class, 'stores']);
            Route::get('stores/{slug}', [MarketController::class, 'store']);
            Route::post('orders', [MarketController::class, 'placeOrder'])->middleware('throttle:20,1');
            Route::get('orders', [MarketController::class, 'myOrders']);
            Route::post('orders/{order}/cancel', [MarketController::class, 'cancelMyOrder']);
        });
        Route::prefix('store')->middleware('permission:store.manage_own')->group(function () {
            Route::get('/', [MarketController::class, 'myStore']);
            Route::post('/', [MarketController::class, 'saveStore']);
            Route::get('products', [MarketController::class, 'products']);
            Route::post('products', [MarketController::class, 'saveProduct']);
            Route::post('products/{product}', [MarketController::class, 'saveProduct']);
            Route::delete('products/{product}', [MarketController::class, 'deleteProduct']);
            Route::get('orders', [MarketController::class, 'storeOrders']);
            Route::post('orders/{order}/status', [MarketController::class, 'updateOrder']);
        });

        // ------------------------------------------------------------ M14 reports
        Route::middleware('permission:reports.view')->group(function () {
            Route::get('reports/summary', [ReportsController::class, 'summary']);
            Route::get('reports/export/{type}', [ReportsController::class, 'export']);
        });

        // ------------------------------------------------------------ administration
        Route::prefix('admin')->group(function () {
            Route::get('settings', [Admin\SettingsController::class, 'show'])->middleware('permission:settings.manage');
            Route::put('settings', [Admin\SettingsController::class, 'update'])->middleware('permission:settings.manage');
            Route::get('residents', [Admin\SettingsController::class, 'residents'])->middleware('permission:residents.view');
            Route::get('stores', [MarketController::class, 'adminStores'])->middleware('permission:stores.approve');
            Route::post('stores/{store}/decision', [MarketController::class, 'decideStore'])->middleware('permission:stores.approve');
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
