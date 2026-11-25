<?php

namespace App\Services\Market;

use App\Exceptions\BusinessRuleException;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Store;
use App\Models\User;
use App\Notifications\GenericNotification;
use App\Services\AuditLogger;
use App\Services\CodeGenerator;
use Illuminate\Support\Facades\DB;

/**
 * WF-13 marketplace order: placed → accepted (stock reserved) → ready → delivered; the buyer can
 * cancel while placed; the store can reject a placed order or cancel an accepted one (stock returned).
 * Payment is on delivery (SRS Q18 default).
 */
class OrderService
{
    public function __construct(private readonly CodeGenerator $codes, private readonly AuditLogger $audit) {}

    /** @param list<array{product_id:int, quantity:int}> $items */
    public function place(User $buyer, Store $store, array $items, ?string $note): Order
    {
        if ($store->status !== 'active') {
            throw new BusinessRuleException('This store is not accepting orders.', 'STORE_UNAVAILABLE');
        }

        $order = DB::transaction(function () use ($buyer, $store, $items, $note) {
            $products = Product::query()->where('store_id', $store->id)->where('is_active', true)
                ->whereIn('id', array_column($items, 'product_id'))->get()->keyBy('id');

            $lines = [];
            $total = 0;
            foreach ($items as $item) {
                $product = $products->get($item['product_id']);
                if (! $product) {
                    throw new BusinessRuleException('One of the items is no longer available.', 'PRODUCT_UNAVAILABLE');
                }
                if ($product->stock < $item['quantity']) {
                    throw new BusinessRuleException("Only {$product->stock} of {$product->name} left in stock.", 'OUT_OF_STOCK');
                }
                $line = round((float) $product->price * $item['quantity'], 2);
                $total += $line;
                $lines[] = ['product_id' => $product->id, 'name' => $product->name, 'unit_price' => $product->price, 'quantity' => $item['quantity'], 'line_total' => $line];
            }

            $order = Order::create([
                'reference' => $this->codes->next('orders', 'reference', 'ORD', 5),
                'store_id' => $store->id,
                'buyer_user_id' => $buyer->id,
                'household_id' => $buyer->household()?->id,
                'status' => 'placed',
                'total' => round($total, 2),
                'payment_method' => 'pay_on_delivery',
                'delivery_note' => $note,
            ]);
            foreach ($lines as $line) {
                OrderItem::create($line + ['order_id' => $order->id]);
            }

            return $order;
        });

        $store->owner?->notify(new GenericNotification('New order '.$order->reference, $buyer->name.' ordered ₦'.number_format((float) $order->total, 2), '/store/orders', 'market'));

        return $order->load('items');
    }

    public function storeTransition(Order $order, string $to, User $owner, ?string $reason = null): Order
    {
        $allowed = Order::TRANSITIONS[$order->status] ?? [];
        if (! in_array($to, $allowed, true)) {
            throw BusinessRuleException::invalidState("An order that is {$order->status} cannot be marked {$to}.");
        }
        if (in_array($to, ['rejected', 'cancelled'], true) && ! $reason) {
            throw new BusinessRuleException('Give a reason.', 'VALIDATION_FAILED');
        }

        DB::transaction(function () use ($order, $to, $reason) {
            $order->load('items');
            if ($to === 'accepted') {
                foreach ($order->items as $item) {
                    $affected = Product::query()->whereKey($item->product_id)->where('stock', '>=', $item->quantity)->decrement('stock', $item->quantity);
                    if (! $affected) {
                        throw new BusinessRuleException("Not enough stock for {$item->name}.", 'OUT_OF_STOCK');
                    }
                }
            }
            if ($to === 'cancelled' && $order->status !== 'placed') {
                foreach ($order->items as $item) {
                    Product::query()->whereKey($item->product_id)->increment('stock', $item->quantity);
                }
            }
            $order->update(['status' => $to, 'status_reason' => $reason]);
        });

        $order->buyer?->notify(new GenericNotification('Order '.$order->reference.' '.$to, $reason, '/resident/market/orders', 'market'));
        $this->audit->log('order.'.$to, $order, null, ['reason' => $reason], $owner);

        return $order->refresh()->load('items');
    }

    public function buyerCancel(Order $order, User $buyer): Order
    {
        if ($order->status !== 'placed') {
            throw BusinessRuleException::invalidState('Orders can be cancelled only before the store accepts them.');
        }
        $order->update(['status' => 'cancelled', 'status_reason' => 'Cancelled by buyer']);
        $order->store?->owner?->notify(new GenericNotification('Order '.$order->reference.' cancelled by buyer', null, '/store/orders', 'market'));

        return $order->load('items');
    }
}
