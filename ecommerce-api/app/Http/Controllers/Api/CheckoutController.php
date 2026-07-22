<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CartItem;
use App\Models\Product;
use App\Services\CheckoutQuoteService;
use App\Services\ShippingQuoteCalculator;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CheckoutController extends Controller
{
    public function quote(Request $request, CheckoutQuoteService $quoteService)
    {
        $validated = $this->validateZone($request);

        $cartItems = $request->user()->cartItems()
            ->with('product.category:id,slug')
            ->get();
        $lines = $cartItems->map(fn (CartItem $item): array => [
            'product' => $item->product,
            'quantity' => $item->quantity,
        ]);

        return $this->quoteResponse(
            $quoteService->build($lines, $validated['emirate_code'])
        );
    }

    public function guestQuote(Request $request, CheckoutQuoteService $quoteService)
    {
        $this->normalizeZone($request);
        $validated = $request->validate([
            'emirate_code' => [
                'required',
                'string',
                Rule::in(ShippingQuoteCalculator::supportedZoneCodes()),
            ],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.product_id' => ['required', 'integer', 'distinct:strict'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:99'],
        ], [
            'emirate_code.in' => 'Delivery is not available for this emirate code.',
        ]);

        $productIds = collect($validated['items'])
            ->pluck('product_id')
            ->map(fn (mixed $id): int => (int) $id);
        $products = Product::query()
            ->with('category:id,slug')
            ->whereKey($productIds)
            ->get()
            ->keyBy('id');
        $lines = collect($validated['items'])->map(fn (array $item): array => [
            'product' => $products->get((int) $item['product_id']),
            'quantity' => (int) $item['quantity'],
        ]);

        return $this->quoteResponse(
            $quoteService->build($lines, $validated['emirate_code'])
        );
    }

    /**
     * @return array{emirate_code: string}
     */
    private function validateZone(Request $request): array
    {
        $this->normalizeZone($request);

        return $request->validate([
            'emirate_code' => [
                'required',
                'string',
                Rule::in(ShippingQuoteCalculator::supportedZoneCodes()),
            ],
        ], [
            'emirate_code.in' => 'Delivery is not available for this emirate code.',
        ]);
    }

    private function normalizeZone(Request $request): void
    {
        if (is_string($request->input('emirate_code'))) {
            $request->merge([
                'emirate_code' => strtoupper(trim($request->input('emirate_code'))),
            ]);
        }
    }

    /**
     * @param  array<string, mixed>|null  $quote
     */
    private function quoteResponse(?array $quote)
    {
        if ($quote === null) {
            return response()->json([
                'message' => 'Your cart has no available items to quote.',
            ], 422);
        }

        return response()->json($quote);
    }
}
