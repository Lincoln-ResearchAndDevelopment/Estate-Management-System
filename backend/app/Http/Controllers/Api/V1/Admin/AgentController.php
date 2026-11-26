<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Models\AgentProfile;
use App\Models\PropertyListing;
use App\Services\Listings\AgentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Agent applications and agent accounts (FR-LIST-05, FR-LIST-20). */
class AgentController extends Controller
{
    public function __construct(private readonly AgentService $agents) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(['pending', 'approved', 'rejected', 'suspended'])],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        $page = AgentProfile::query()->with('user')
            ->when($filters['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($filters['q'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w
                ->whereHas('user', fn ($u) => $u->search($v))->orWhere('agency_name', 'like', "%{$v}%")))
            ->orderByRaw("case when status = 'pending' then 0 else 1 end")->latest('id')
            ->paginate(max(1, min(100, (int) $request->query('pageSize', 10))));

        $liveCounts = PropertyListing::query()->where('status', 'approved')
            ->whereIn('agent_user_id', $page->getCollection()->pluck('user_id'))
            ->selectRaw('agent_user_id, count(*) as total')->groupBy('agent_user_id')->pluck('total', 'agent_user_id');

        return response()->json([
            'data' => $page->getCollection()->map(fn (AgentProfile $p) => $this->present($p, (int) ($liveCounts[$p->user_id] ?? 0)))->values(),
            'meta' => [
                'page' => $page->currentPage(), 'pageSize' => $page->perPage(), 'total' => $page->total(), 'totalPages' => $page->lastPage(),
                'pendingCount' => AgentProfile::where('status', 'pending')->count(),
            ],
        ]);
    }

    public function idDocument(AgentProfile $agent): StreamedResponse
    {
        abort_unless(Storage::disk('local')->exists($agent->id_document_path), 404);

        return Storage::disk('local')->response($agent->id_document_path, null, ['Cache-Control' => 'private, no-store']);
    }

    public function approve(Request $request, AgentProfile $agent): JsonResponse
    {
        return response()->json(['data' => $this->present($this->agents->approve($agent, $request->user()))]);
    }

    public function reject(Request $request, AgentProfile $agent): JsonResponse
    {
        return response()->json(['data' => $this->present($this->agents->reject($agent, $request->user(), $this->reason($request)))]);
    }

    public function suspend(Request $request, AgentProfile $agent): JsonResponse
    {
        return response()->json(['data' => $this->present($this->agents->suspend($agent, $request->user(), $this->reason($request)))]);
    }

    public function reinstate(Request $request, AgentProfile $agent): JsonResponse
    {
        return response()->json(['data' => $this->present($this->agents->reinstate($agent, $request->user()))]);
    }

    private function reason(Request $request): string
    {
        return $request->validate(['reason' => ['required', 'string', 'min:10', 'max:500']])['reason'];
    }

    private function present(AgentProfile $p, ?int $liveListings = null): array
    {
        return [
            'id' => $p->id,
            'userId' => $p->user_id,
            'name' => $p->user?->name,
            'email' => $p->user?->email,
            'phone' => $p->user?->phone,
            'agencyName' => $p->agency_name,
            'agencyRegNo' => $p->agency_reg_no,
            'status' => $p->status,
            'verified' => $p->verified,
            'decisionReason' => $p->decision_reason,
            'idDocumentUrl' => url("/api/v1/admin/agents/{$p->id}/id-document"),
            'liveListings' => $liveListings ?? PropertyListing::where('agent_user_id', $p->user_id)->where('status', 'approved')->count(),
            'appliedAt' => $p->created_at?->toIso8601String(),
        ];
    }
}
