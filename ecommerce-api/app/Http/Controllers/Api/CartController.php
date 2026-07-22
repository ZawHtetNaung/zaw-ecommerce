<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CartController extends Controller
{
    public function index(Request $request)
    {
        return response()->json($this->payload($request->user()));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'quantity' => ['nullable', 'integer', 'min:1', 'max:99'],
        ]);

        $product = Product::query()
            ->where('is_active', true)
            ->findOrFail($validated['product_id']);

        if (! $product->is_in_stock || $product->stock < 1) {
            return response()->json(['message' => 'This product is currently out of stock.'], 422);
        }

        $item = CartItem::query()->firstOrNew([
            'user_id' => $request->user()->id,
            'product_id' => $product->id,
        ]);
        $quantity = ($item->exists ? $item->quantity : 0) + ($validated['quantity'] ?? 1);

        if ($quantity > $product->stock) {
            return response()->json(['message' => 'The requested quantity is higher than the available stock.'], 422);
        }

        $item->quantity = $quantity;
        $item->save();

        return response()->json($this->payload($request->user()), 201);
    }

    public function update(Request $request, CartItem $cartItem)
    {
        $this->ensureOwnership($request, $cartItem);
        $validated = $request->validate([
            'quantity' => ['required', 'integer', 'min:1', 'max:99'],
        ]);
        $cartItem->loadMissing('product');

        if (! $cartItem->product->is_active || ! $cartItem->product->is_in_stock || $cartItem->product->stock < 1) {
            return response()->json(['message' => 'This product is currently out of stock.'], 422);
        }

        if ($validated['quantity'] > $cartItem->product->stock) {
            return response()->json(['message' => 'The requested quantity is higher than the available stock.'], 422);
        }

        $cartItem->update(['quantity' => $validated['quantity']]);

        return response()->json($this->payload($request->user()));
    }

    public function destroy(Request $request, CartItem $cartItem)
    {
        $this->ensureOwnership($request, $cartItem);
        $cartItem->delete();

        return response()->json($this->payload($request->user()));
    }

    public function clear(Request $request)
    {
        $request->user()->cartItems()->delete();

        return response()->json($this->payload($request->user()));
    }

    public function merge(Request $request)
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.product_id' => ['required', 'integer', 'distinct:strict'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
        ]);

        $requestedItems = collect($validated['items'])
            ->map(fn (array $item): array => [
                'product_id' => (int) $item['product_id'],
                'quantity' => (int) $item['quantity'],
            ])
            ->sortBy('product_id')
            ->values();

        DB::transaction(function () use ($request, $requestedItems): void {
            $productIds = $requestedItems->pluck('product_id');
            $products = Product::query()
                ->whereKey($productIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');
            $existingItems = $request->user()->cartItems()
                ->whereIn('product_id', $productIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('product_id');

            foreach ($requestedItems as $requestedItem) {
                $product = $products->get($requestedItem['product_id']);

                if (! $product || ! $product->is_active || ! $product->is_in_stock || $product->stock < 1) {
                    continue;
                }

                $cartItem = $existingItems->get($product->id);
                $existingQuantity = $cartItem?->quantity ?? 0;
                $maximumQuantity = min(99, $product->stock);
                $mergedQuantity = min(
                    $maximumQuantity,
                    $existingQuantity + $requestedItem['quantity']
                );

                if ($cartItem) {
                    $cartItem->update(['quantity' => $mergedQuantity]);

                    continue;
                }

                CartItem::query()->create([
                    'user_id' => $request->user()->id,
                    'product_id' => $product->id,
                    'quantity' => $mergedQuantity,
                ]);
            }
        });

        return response()->json($this->payload($request->user()));
    }

    private function ensureOwnership(Request $request, CartItem $cartItem): void
    {
        abort_unless($cartItem->user_id === $request->user()->id, 404);
    }

    private function payload(User $user): array
    {
        $items = $user->cartItems()
            ->with([
                'product.category:id,name,slug',
                'product.subCategory:id,category_id,name,slug',
                'product.brand:id,name',
                'product.images',
            ])
            ->latest()
            ->get()
            ->map(function (CartItem $item): array {
                $unitPrice = (float) ($item->product->discount_price ?: $item->product->price);
                $isAvailable = $item->product->is_active
                    && $item->product->is_in_stock
                    && $item->product->stock >= $item->quantity;

                return [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'quantity' => $item->quantity,
                    'is_available' => $isAvailable,
                    'unit_price' => number_format($unitPrice, 2, '.', ''),
                    'line_total' => number_format($unitPrice * $item->quantity, 2, '.', ''),
                    'product' => $item->product,
                ];
            });
        $availableItems = $items->where('is_available', true);

        return [
            'items' => $items->values(),
            'count' => $availableItems->sum('quantity'),
            'subtotal' => number_format($availableItems->sum(fn (array $item) => (float) $item['line_total']), 2, '.', ''),
        ];
    }
}
