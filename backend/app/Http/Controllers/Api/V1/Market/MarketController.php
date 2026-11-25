<?php

namespace App\Http\Controllers\Api\V1\Market;

use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use App\Notifications\GenericNotification;
use App\Services\AuditLogger;
use App\Services\Market\OrderService;
use App\Support\ApiResponse;
use App\Support\Present;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** M06 marketplace & stores: shopping (residents), store management (store owners), approval (EM). */
class MarketController extends Controller
{
    public function __construct(private readonly OrderService $orders, private readonly AuditLogger $audit) {}

    // ------------------------------------------------------------ shoppers

    public function stores(Request $request): JsonResponse
    {
        $f = $request->validate(['category' => ['nullable', Rule::in(Store::CATEGORIES)], 'q' => ['nullable', 'string', 'max:60']]);

        $page = Store::query()->where('status', 'active')->withCount(['products' => fn ($q) => $q->where('is_active', true)])
            ->when($f['category'] ?? null, fn ($q, $v) => $q->where('category', $v))
            ->when($f['q'] ?? null, fn ($q, $v) => $q->where('name', 'like', "%{$v}%"))
            ->orderByRaw("CASE plan WHEN 'premium' THEN 0 WHEN 'standard' THEN 1 ELSE 2 END")->orderBy('name')
            ->paginate(ApiResponse::pageSize($request, 12));

        return ApiResponse::paginateMap($page, fn ($s) => Present::store($s));
    }

    public function store(string $slug): JsonResponse
    {
        $store = Store::query()->where('status', 'active')->where('slug', $slug)->firstOrFail();

        return response()->json(['data' => Present::store($store) + [
            'products' => $store->products()->where('is_active', true)->orderBy('name')->get()->map(fn ($p) => Present::product($p)),
        ]]);
    }

    public function placeOrder(Request $request): JsonResponse
    {
        $data = $request->validate([
            'store_id' => ['required', 'integer', 'exists:stores,id'],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
            'delivery_note' => ['nullable', 'string', 'max:500'],
        ]);

        $order = $this->orders->place($request->user(), Store::findOrFail($data['store_id']), $data['items'], $data['delivery_note'] ?? null);

        return response()->json(['data' => Present::order($order->load(['store', 'items']))], 201);
    }

    public function myOrders(Request $request): JsonResponse
    {
        $page = Order::query()->with(['store', 'items'])->where('buyer_user_id', $request->user()->id)->latest()->paginate(ApiResponse::pageSize($request));

        return ApiResponse::paginateMap($page, fn ($o) => Present::order($o));
    }

    public function cancelMyOrder(Request $request, Order $order): JsonResponse
    {
        abort_unless($order->buyer_user_id === $request->user()->id, 404);

        return response()->json(['data' => Present::order($this->orders->buyerCancel($order, $request->user())->load('store'))]);
    }

    // ------------------------------------------------------------ store owners

    public function myStore(Request $request): JsonResponse
    {
        $store = $request->user()->store()->first();
        if (! $store) {
            return response()->json(['data' => null]);
        }

        $orders = Order::query()->where('store_id', $store->id);

        return response()->json(['data' => Present::store($store) + [
            'kpis' => [
                'newOrders' => (clone $orders)->where('status', 'placed')->count(),
                'inProgress' => (clone $orders)->whereIn('status', ['accepted', 'ready'])->count(),
                'deliveredThisMonth' => (clone $orders)->where('status', 'delivered')->where('updated_at', '>=', now()->startOfMonth())->count(),
                'salesThisMonth' => Present::money((clone $orders)->where('status', 'delivered')->where('updated_at', '>=', now()->startOfMonth())->sum('total')),
                'products' => $store->products()->count(),
                'lowStock' => $store->products()->where('is_active', true)->where('stock', '<=', 3)->count(),
            ],
        ]]);
    }

    /** Register (or update) the owner's store; a new store waits for estate approval (WF-12). */
    public function saveStore(Request $request): JsonResponse
    {
        $user = $request->user();
        $store = $user->store()->first();
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'category' => ['required', Rule::in(Store::CATEGORIES)],
            'description' => ['nullable', 'string', 'max:1000'],
            'phone' => ['nullable', 'regex:/^\+234\d{10}$/'],
            'location' => ['nullable', 'string', 'max:150'],
            'logo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:'.config('estate.uploads.image_max_kb')],
        ]);

        $attrs = collect($data)->except('logo')->all();
        if ($request->hasFile('logo')) {
            $attrs['logo_path'] = $request->file('logo')->store('stores', 'public');
        }

        if ($store) {
            $store->update($attrs);
        } else {
            $store = Store::create($attrs + ['owner_user_id' => $user->id, 'slug' => $this->slug($data['name']), 'status' => 'pending', 'plan' => 'basic']);
            $managers = User::query()->where('status', 'active')->whereHas('roles', fn ($q) => $q->whereIn('code', ['estate_manager', 'super_admin']))->get();
            Notification::send($managers, new GenericNotification('New store awaiting approval', $store->name, '/admin/stores', 'market'));
        }

        return response()->json(['data' => Present::store($store)], $store->wasRecentlyCreated ? 201 : 200);
    }

    public function products(Request $request): JsonResponse
    {
        $store = $this->ownStore($request);

        return response()->json(['data' => $store->products()->orderBy('name')->get()->map(fn ($p) => Present::product($p))]);
    }

    public function saveProduct(Request $request, ?Product $product = null): JsonResponse
    {
        $store = $this->ownStore($request);
        if ($product) {
            abort_unless($product->store_id === $store->id, 404);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'description' => ['nullable', 'string', 'max:1000'],
            'price' => ['required', 'numeric', 'gt:0', 'max:10000000'],
            'stock' => ['required', 'integer', 'min:0', 'max:100000'],
            'is_active' => ['required', 'boolean'],
            'image' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:'.config('estate.uploads.image_max_kb')],
        ]);

        $attrs = collect($data)->except('image')->all();
        if ($request->hasFile('image')) {
            if ($product?->image_path) {
                Storage::disk('public')->delete($product->image_path);
            }
            $attrs['image_path'] = $request->file('image')->store("stores/{$store->id}/products", 'public');
        }

        $product = $product ? tap($product)->update($attrs) : Product::create($attrs + ['store_id' => $store->id]);

        return response()->json(['data' => Present::product($product)], $product->wasRecentlyCreated ? 201 : 200);
    }

    public function deleteProduct(Request $request, Product $product): JsonResponse
    {
        abort_unless($product->store_id === $this->ownStore($request)->id, 404);
        $product->update(['is_active' => false]);
        $product->delete();

        return ApiResponse::message('Product removed.');
    }

    public function storeOrders(Request $request): JsonResponse
    {
        $store = $this->ownStore($request);
        $status = $request->validate(['status' => ['nullable', Rule::in(['placed', 'accepted', 'ready', 'delivered', 'cancelled', 'rejected', 'open'])]])['status'] ?? null;

        $page = Order::query()->with(['buyer', 'items'])->where('store_id', $store->id)
            ->when($status, fn ($q, $v) => $v === 'open' ? $q->whereIn('status', ['placed', 'accepted', 'ready']) : $q->where('status', $v))
            ->latest()->paginate(ApiResponse::pageSize($request, 15));

        return ApiResponse::paginateMap($page, fn ($o) => Present::order($o));
    }

    public function updateOrder(Request $request, Order $order): JsonResponse
    {
        abort_unless($order->store_id === $this->ownStore($request)->id, 404);
        $data = $request->validate(['status' => ['required', Rule::in(['accepted', 'rejected', 'ready', 'delivered', 'cancelled'])], 'reason' => ['nullable', 'string', 'max:255']]);

        return response()->json(['data' => Present::order($this->orders->storeTransition($order, $data['status'], $request->user(), $data['reason'] ?? null)->load('buyer'))]);
    }

    // ------------------------------------------------------------ estate management

    public function adminStores(Request $request): JsonResponse
    {
        $status = $request->validate(['status' => ['nullable', Rule::in(['pending', 'active', 'suspended', 'rejected'])]])['status'] ?? null;

        $page = Store::query()->with('owner')->withCount('products')
            ->when($status, fn ($q, $v) => $q->where('status', $v))
            ->orderByRaw("CASE WHEN status = 'pending' THEN 0 ELSE 1 END")->latest()->paginate(ApiResponse::pageSize($request, 15));

        return ApiResponse::paginateMap($page, fn ($s) => Present::store($s), ['pendingCount' => Store::where('status', 'pending')->count()]);
    }

    public function decideStore(Request $request, Store $store): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['active', 'suspended', 'rejected'])],
            'plan' => ['sometimes', Rule::in(['basic', 'standard', 'premium'])],
            'reason' => ['required_unless:status,active', 'nullable', 'string', 'min:5', 'max:500'],
        ]);

        $store->update(['status' => $data['status'], 'plan' => $data['plan'] ?? $store->plan, 'decision_reason' => $data['reason'] ?? null]);
        $store->owner?->notify(new GenericNotification('Your store is '.$data['status'], $data['reason'] ?? null, '/store', 'market', email: true));
        $this->audit->log('store.'.$data['status'], $store, null, $data);

        return response()->json(['data' => Present::store($store->load('owner'))]);
    }

    private function ownStore(Request $request): Store
    {
        $store = $request->user()->store()->first();
        if (! $store) {
            throw new BusinessRuleException('Register your store first.', 'NO_STORE', 404);
        }

        return $store;
    }

    private function slug(string $name): string
    {
        $base = Str::slug($name) ?: 'store';
        $slug = $base;
        $i = 2;
        while (Store::where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }
}
