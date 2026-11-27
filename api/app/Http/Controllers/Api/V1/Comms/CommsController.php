<?php

namespace App\Http\Controllers\Api\V1\Comms;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\CommunityPost;
use App\Models\Conversation;
use App\Models\Meeting;
use App\Models\Message;
use App\Models\PostComment;
use App\Models\User;
use App\Notifications\GenericNotification;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;

/**
 * M07 communication: notices (announcements), meetings with RSVP and minutes, the community feed with
 * moderation, and private messaging. Lists refresh by polling (SRS NFR allows ≤ 10 s for chat).
 */
class CommsController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    // ------------------------------------------------------------ notices

    public function announcements(Request $request): JsonResponse
    {
        $audiences = $this->audiencesFor($request->user());
        $page = Announcement::query()->with('publisher')->whereIn('audience', $audiences)
            // Publishers also see expired notices; everyone else sees only current ones.
            ->when(! $request->user()->hasPermission('comms.publish'), fn ($q) => $q->where(fn ($w) => $w->whereNull('expires_at')->orWhere('expires_at', '>', now())))
            ->orderByDesc('pinned')->latest('published_at')->paginate(ApiResponse::pageSize($request));

        return ApiResponse::paginateMap($page, fn (Announcement $a) => $this->presentAnnouncement($a));
    }

    public function storeAnnouncement(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:150'],
            'body' => ['required', 'string', 'min:10', 'max:5000'],
            'audience' => ['required', Rule::in(['all', 'residents', 'staff', 'security'])],
            'pinned' => ['sometimes', 'boolean'],
            'expires_at' => ['nullable', 'date', 'after:now'],
            'notify' => ['sometimes', 'boolean'],
        ]);

        $notice = Announcement::create(collect($data)->except('notify')->all() + ['published_by' => $request->user()->id, 'published_at' => now()]);
        $this->audit->log('announcement.published', $notice, after: ['title' => $notice->title]);

        if ($data['notify'] ?? true) {
            Notification::send($this->usersForAudience($notice->audience), new GenericNotification('Notice: '.$notice->title, str($notice->body)->limit(140)->toString(), '/notices', 'notices'));
        }

        return response()->json(['data' => $this->presentAnnouncement($notice->load('publisher'))], 201);
    }

    public function deleteAnnouncement(Announcement $announcement): JsonResponse
    {
        $this->audit->log('announcement.deleted', $announcement, ['title' => $announcement->title]);
        $announcement->delete();

        return ApiResponse::message('Notice removed.');
    }

    // ------------------------------------------------------------ meetings

    public function meetings(Request $request): JsonResponse
    {
        $when = $request->validate(['when' => ['nullable', Rule::in(['upcoming', 'past'])]])['when'] ?? 'upcoming';
        $userId = $request->user()->id;

        $page = Meeting::query()->with('creator')
            ->when($when === 'upcoming', fn ($q) => $q->where('starts_at', '>=', now()->subHours(3))->orderBy('starts_at'))
            ->when($when === 'past', fn ($q) => $q->where('starts_at', '<', now()->subHours(3))->orderByDesc('starts_at'))
            ->paginate(ApiResponse::pageSize($request));

        return ApiResponse::paginateMap($page, fn (Meeting $m) => $this->presentMeeting($m, $userId));
    }

    public function storeMeeting(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:150'],
            'agenda' => ['nullable', 'string', 'max:5000'],
            'location' => ['required', 'string', 'max:150'],
            'starts_at' => ['required', 'date', 'after:now'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
        ]);

        $meeting = Meeting::create($data + ['created_by' => $request->user()->id, 'status' => 'scheduled']);
        Notification::send($this->usersForAudience('residents'), new GenericNotification('Meeting: '.$meeting->title, $meeting->starts_at->timezone('Africa/Lagos')->format('D, M j · g:i A').' at '.$meeting->location, '/meetings', 'meetings'));
        $this->audit->log('meeting.scheduled', $meeting, after: $data);

        return response()->json(['data' => $this->presentMeeting($meeting, $request->user()->id)], 201);
    }

    public function updateMeeting(Request $request, Meeting $meeting): JsonResponse
    {
        $data = $request->validate([
            'status' => ['sometimes', Rule::in(['scheduled', 'cancelled', 'held'])],
            'minutes' => ['sometimes', 'nullable', 'string', 'max:20000'],
            'location' => ['sometimes', 'string', 'max:150'],
            'starts_at' => ['sometimes', 'date'],
        ]);

        $meeting->update($data);
        if (($data['status'] ?? null) === 'cancelled') {
            Notification::send($this->usersForAudience('residents'), new GenericNotification('Meeting cancelled: '.$meeting->title, null, '/meetings', 'meetings'));
        }
        $this->audit->log('meeting.updated', $meeting, null, $data);

        return response()->json(['data' => $this->presentMeeting($meeting, $request->user()->id)]);
    }

    public function rsvp(Request $request, Meeting $meeting): JsonResponse
    {
        $response = $request->validate(['response' => ['required', Rule::in(['yes', 'no', 'maybe'])]])['response'];
        abort_if($meeting->status !== 'scheduled', 422, 'RSVP is closed for this meeting.');

        DB::table('meeting_rsvps')->updateOrInsert(
            ['meeting_id' => $meeting->id, 'user_id' => $request->user()->id],
            ['response' => $response, 'updated_at' => now(), 'created_at' => now()],
        );

        return response()->json(['data' => $this->presentMeeting($meeting, $request->user()->id)]);
    }

    // ------------------------------------------------------------ community feed

    public function posts(Request $request): JsonResponse
    {
        $moderator = $request->user()->hasPermission('comms.moderate');
        $page = CommunityPost::query()->with(['author', 'comments.author'])
            ->when(! $moderator, fn ($q) => $q->where('status', 'visible'))
            ->latest()->paginate(ApiResponse::pageSize($request));

        return ApiResponse::paginateMap($page, fn (CommunityPost $p) => $this->presentPost($p, $request->user()));
    }

    public function storePost(Request $request): JsonResponse
    {
        $body = $request->validate(['body' => ['required', 'string', 'min:2', 'max:2000']])['body'];
        $post = CommunityPost::create(['user_id' => $request->user()->id, 'body' => strip_tags($body), 'status' => 'visible']);

        return response()->json(['data' => $this->presentPost($post->load(['author', 'comments']), $request->user())], 201);
    }

    public function comment(Request $request, CommunityPost $post): JsonResponse
    {
        abort_if($post->status !== 'visible', 404);
        $body = $request->validate(['body' => ['required', 'string', 'min:1', 'max:1000']])['body'];
        PostComment::create(['community_post_id' => $post->id, 'user_id' => $request->user()->id, 'body' => strip_tags($body)]);

        if ($post->user_id !== $request->user()->id) {
            $post->author?->notify(new GenericNotification($request->user()->name.' commented on your post', str($body)->limit(100)->toString(), '/community', 'community'));
        }

        return response()->json(['data' => $this->presentPost($post->load(['author', 'comments.author']), $request->user())], 201);
    }

    public function deletePost(Request $request, CommunityPost $post): JsonResponse
    {
        abort_unless($post->user_id === $request->user()->id, 404);
        $post->delete();

        return ApiResponse::message('Post deleted.');
    }

    public function moderate(Request $request, CommunityPost $post): JsonResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(['visible', 'hidden'])], 'reason' => ['required_if:status,hidden', 'nullable', 'string', 'max:255']]);
        $post->update(['status' => $data['status'], 'moderated_by' => $request->user()->id, 'moderation_reason' => $data['reason'] ?? null]);
        $this->audit->log('post.'.$data['status'], $post, null, $data);

        return response()->json(['data' => $this->presentPost($post->load(['author', 'comments.author']), $request->user())]);
    }

    // ------------------------------------------------------------ private messages

    public function conversations(Request $request): JsonResponse
    {
        $user = $request->user();
        $page = Conversation::query()->whereHas('participants', fn ($q) => $q->whereKey($user->id))
            ->with(['participants:id,name,primary_role'])
            ->orderByDesc('last_message_at')->paginate(ApiResponse::pageSize($request, 20));

        return ApiResponse::paginateMap($page, fn (Conversation $c) => $this->presentConversation($c, $user), [
            'unreadCount' => $this->unreadConversations($user),
        ]);
    }

    public function startConversation(Request $request): JsonResponse
    {
        $data = $request->validate([
            'recipient_ids' => ['required', 'array', 'min:1', 'max:10'],
            'recipient_ids.*' => ['integer', 'exists:users,id'],
            'subject' => ['required', 'string', 'min:2', 'max:150'],
            'body' => ['required', 'string', 'min:1', 'max:5000'],
        ]);

        $allowed = $this->contactsQuery($request->user())->whereIn('id', $data['recipient_ids'])->pluck('id');
        abort_if($allowed->isEmpty(), 422, 'You cannot message these people.');

        $conversation = DB::transaction(function () use ($data, $request, $allowed) {
            $conversation = Conversation::create(['subject' => $data['subject'], 'created_by' => $request->user()->id, 'last_message_at' => now()]);
            $conversation->participants()->attach($allowed->push($request->user()->id)->unique()->mapWithKeys(fn ($id) => [$id => ['last_read_at' => $id === $request->user()->id ? now() : null]])->all());
            Message::create(['conversation_id' => $conversation->id, 'user_id' => $request->user()->id, 'body' => strip_tags($data['body'])]);

            return $conversation;
        });

        $this->notifyParticipants($conversation, $request->user(), $data['body']);

        return response()->json(['data' => $this->presentConversation($conversation->load('participants'), $request->user())], 201);
    }

    public function messages(Request $request, Conversation $conversation): JsonResponse
    {
        $this->participant($conversation, $request->user());
        $after = (int) $request->query('after', 0);

        $messages = Message::query()->with('author:id,name')->where('conversation_id', $conversation->id)
            ->when($after, fn ($q) => $q->where('id', '>', $after))
            ->orderBy('id')->limit(200)->get();

        $conversation->participants()->updateExistingPivot($request->user()->id, ['last_read_at' => now()]);

        return response()->json(['data' => [
            'conversation' => $this->presentConversation($conversation->load('participants'), $request->user()),
            'messages' => $messages->map(fn (Message $m) => [
                'id' => $m->id, 'body' => $m->body, 'author' => $m->author?->name,
                'mine' => $m->user_id === $request->user()->id, 'createdAt' => $m->created_at?->toIso8601String(),
            ]),
        ]]);
    }

    public function sendMessage(Request $request, Conversation $conversation): JsonResponse
    {
        $this->participant($conversation, $request->user());
        $body = $request->validate(['body' => ['required', 'string', 'min:1', 'max:5000']])['body'];

        $message = Message::create(['conversation_id' => $conversation->id, 'user_id' => $request->user()->id, 'body' => strip_tags($body)]);
        $conversation->update(['last_message_at' => now()]);
        $conversation->participants()->updateExistingPivot($request->user()->id, ['last_read_at' => now()]);
        $this->notifyParticipants($conversation, $request->user(), $body);

        return response()->json(['data' => ['id' => $message->id, 'body' => $message->body, 'author' => $request->user()->name, 'mine' => true, 'createdAt' => $message->created_at?->toIso8601String()]], 201);
    }

    /** People the user may start a conversation with: residents reach management and security; staff reach everyone. */
    public function contacts(Request $request): JsonResponse
    {
        $q = $request->validate(['q' => ['nullable', 'string', 'max:60']])['q'] ?? null;

        return response()->json(['data' => $this->contactsQuery($request->user())
            ->when($q, fn ($w) => $w->where('name', 'like', "%{$q}%"))
            ->orderBy('name')->limit(25)->get(['id', 'name', 'primary_role'])
            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name, 'role' => config('rbac.roles.'.$u->primary_role)])]);
    }

    // ------------------------------------------------------------ helpers

    private function contactsQuery(User $user)
    {
        $staffRoles = ['super_admin', 'estate_manager', 'finance_officer', 'security_officer'];
        $query = User::query()->where('status', 'active')->whereKeyNot($user->id);

        return in_array($user->primary_role, $staffRoles, true)
            ? $query->where('primary_role', '!=', 'agent')
            : $query->whereIn('primary_role', $staffRoles);
    }

    private function participant(Conversation $conversation, User $user): void
    {
        abort_unless($conversation->participants()->whereKey($user->id)->exists(), 404);
    }

    private function unreadConversations(User $user): int
    {
        return DB::table('conversation_participants as cp')->join('conversations as c', 'c.id', '=', 'cp.conversation_id')
            ->where('cp.user_id', $user->id)
            ->where(fn ($q) => $q->whereNull('cp.last_read_at')->orWhereColumn('c.last_message_at', '>', 'cp.last_read_at'))->count();
    }

    private function notifyParticipants(Conversation $conversation, User $sender, string $body): void
    {
        $others = $conversation->participants()->whereKeyNot($sender->id)->get();
        Notification::send($others, new GenericNotification('Message from '.$sender->name, str($body)->limit(100)->toString(), '/messages?c='.$conversation->id, 'messages'));
    }

    private function audiencesFor(User $user): array
    {
        return match (true) {
            $user->hasPermission('comms.publish') => ['all', 'residents', 'staff', 'security'],
            $user->hasRole('security_officer') => ['all', 'staff', 'security'],
            $user->hasRole('staff', 'finance_officer') => ['all', 'staff'],
            default => ['all', 'residents'],
        };
    }

    private function usersForAudience(string $audience)
    {
        $roles = match ($audience) {
            'residents' => ['resident_head', 'resident_member'],
            'staff' => ['staff', 'security_officer', 'finance_officer', 'estate_manager'],
            'security' => ['security_officer'],
            default => ['resident_head', 'resident_member', 'staff', 'security_officer', 'finance_officer', 'estate_manager', 'store_owner'],
        };

        return User::query()->where('status', 'active')->whereIn('primary_role', $roles)->get();
    }

    private function presentAnnouncement(Announcement $a): array
    {
        return [
            'id' => $a->id, 'title' => $a->title, 'body' => $a->body, 'audience' => $a->audience, 'pinned' => $a->pinned,
            'publishedBy' => $a->relationLoaded('publisher') ? $a->publisher?->name : null,
            'publishedAt' => $a->published_at?->toIso8601String(), 'expiresAt' => $a->expires_at?->toIso8601String(),
        ];
    }

    private function presentMeeting(Meeting $m, int $userId): array
    {
        $counts = DB::table('meeting_rsvps')->where('meeting_id', $m->id)->selectRaw('response, count(*) as total')->groupBy('response')->pluck('total', 'response');

        return [
            'id' => $m->id, 'title' => $m->title, 'agenda' => $m->agenda, 'location' => $m->location,
            'startsAt' => $m->starts_at?->toIso8601String(), 'endsAt' => $m->ends_at?->toIso8601String(),
            'status' => $m->status, 'minutes' => $m->minutes,
            'createdBy' => $m->relationLoaded('creator') ? $m->creator?->name : null,
            'rsvp' => ['yes' => (int) ($counts['yes'] ?? 0), 'no' => (int) ($counts['no'] ?? 0), 'maybe' => (int) ($counts['maybe'] ?? 0)],
            'myResponse' => DB::table('meeting_rsvps')->where('meeting_id', $m->id)->where('user_id', $userId)->value('response'),
        ];
    }

    private function presentPost(CommunityPost $p, User $viewer): array
    {
        return [
            'id' => $p->id, 'body' => $p->body, 'status' => $p->status, 'moderationReason' => $p->moderation_reason,
            'author' => ['id' => $p->author?->id, 'name' => $p->author?->name, 'role' => config('rbac.roles.'.$p->author?->primary_role)],
            'mine' => $p->user_id === $viewer->id,
            'comments' => $p->relationLoaded('comments') ? $p->comments->sortBy('id')->map(fn ($c) => [
                'id' => $c->id, 'body' => $c->body, 'author' => $c->author?->name, 'createdAt' => $c->created_at?->toIso8601String(),
            ])->values() : [],
            'createdAt' => $p->created_at?->toIso8601String(),
        ];
    }

    private function presentConversation(Conversation $c, User $viewer): array
    {
        $me = $c->participants->firstWhere('id', $viewer->id);
        $last = Message::query()->where('conversation_id', $c->id)->latest('id')->first();

        return [
            'id' => $c->id,
            'subject' => $c->subject,
            'participants' => $c->participants->where('id', '!=', $viewer->id)->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'role' => config('rbac.roles.'.$u->primary_role)])->values(),
            'lastMessage' => $last ? ['body' => str($last->body)->limit(80)->toString(), 'createdAt' => $last->created_at?->toIso8601String()] : null,
            'unread' => $me && $c->last_message_at && (! $me->pivot?->last_read_at || $c->last_message_at->gt($me->pivot->last_read_at)),
            'lastMessageAt' => $c->last_message_at?->toIso8601String(),
        ];
    }
}
