<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

/** In-app notification inbox (FR-NOTIF-01/02). Users only ever see their own notifications. */
class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $unreadOnly = $request->boolean('unread');
        $user = $request->user();

        $page = $user->notifications()
            ->when($unreadOnly, fn ($q) => $q->whereNull('read_at'))
            ->paginate(max(1, min(50, (int) $request->query('pageSize', 10))));

        return response()->json([
            'data' => $page->getCollection()->map(fn (DatabaseNotification $n) => [
                'id' => $n->id,
                'title' => $n->data['title'] ?? 'Notification',
                'body' => $n->data['body'] ?? null,
                'link' => $n->data['link'] ?? null,
                'category' => $n->data['category'] ?? null,
                'readAt' => $n->read_at?->toIso8601String(),
                'createdAt' => $n->created_at?->toIso8601String(),
            ])->values(),
            'meta' => [
                'page' => $page->currentPage(), 'pageSize' => $page->perPage(), 'total' => $page->total(), 'totalPages' => $page->lastPage(),
                'unreadCount' => $user->unreadNotifications()->count(),
            ],
        ]);
    }

    public function markRead(Request $request, string $id): JsonResponse
    {
        $request->user()->notifications()->whereKey($id)->firstOrFail()->markAsRead();

        return ApiResponse::message('Marked as read.');
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return ApiResponse::message('All notifications marked as read.');
    }
}
