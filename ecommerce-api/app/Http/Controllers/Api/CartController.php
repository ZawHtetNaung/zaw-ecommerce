<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CartItem;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\Request;

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

        if ($product->stock < 1) {
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

                return [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'quantity' => $item->quantity,
                    'unit_price' => number_format($unitPrice, 2, '.', ''),
                    'line_total' => number_format($unitPrice * $item->quantity, 2, '.', ''),
                    'product' => $item->product,
                ];
            });

        return [
            'items' => $items->values(),
            'count' => $items->sum('quantity'),
            'subtotal' => number_format($items->sum(fn (array $item) => (float) $item['line_total']), 2, '.', ''),
        ];
    }
}
