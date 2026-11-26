<?php

namespace App\Support;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Consistent success envelopes (SRS Section 10.1):
 *  - single:    { "data": {...} }
 *  - paginated: { "data": [...], "meta": { page, pageSize, total, totalPages } }
 */
class ApiResponse
{
    public static function paginated(LengthAwarePaginator $paginator, string $resourceClass, array $extraMeta = []): JsonResponse
    {
        return response()->json([
            'data' => $resourceClass::collection($paginator->getCollection())->resolve(),
            'meta' => array_merge([
                'page' => $paginator->currentPage(),
                'pageSize' => $paginator->perPage(),
                'total' => $paginator->total(),
                'totalPages' => $paginator->lastPage(),
            ], $extraMeta),
        ]);
    }

    /** Paginated envelope where each row is shaped by a closure (camelCase presenters). */
    public static function paginateMap(LengthAwarePaginator $paginator, callable $map, array $extraMeta = []): JsonResponse
    {
        return response()->json([
            'data' => $paginator->getCollection()->map($map)->values(),
            'meta' => array_merge([
                'page' => $paginator->currentPage(),
                'pageSize' => $paginator->perPage(),
                'total' => $paginator->total(),
                'totalPages' => $paginator->lastPage(),
            ], $extraMeta),
        ]);
    }

    public static function pageSize(Request $request, int $default = 10): int
    {
        return max(1, min(100, (int) $request->query('pageSize', $default)));
    }

    public static function message(string $message, int $status = 200, array $data = []): JsonResponse
    {
        return response()->json(array_filter(['message' => $message, 'data' => $data ?: null]), $status);
    }
}
