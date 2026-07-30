<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CartItem;
use App\Models\Order;
use App\Services\CheckoutQuoteService;
use App\Services\ShippingQuoteCalculator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OrderController extends Controller
{
    private const STATUSES = ['new', 'confirmed', 'processing', 'ready', 'dispatched', 'completed', 'cancelled'];

    private const PAYMENT_STATUSES = ['unpaid', 'pending', 'paid', 'refunded'];

    public function store(Request $request, CheckoutQuoteService $quoteService)
    {
        $this->normalizeZone($request);
        $validated = $request->validate([
            'customer_name' => ['required', 'string', 'min:2', 'max:255'],
            'email' => ['required', 'email:rfc', 'max:255'],
            'phone' => ['required', 'string', 'min:7', 'max:50'],
            'emirate_code' => ['required', 'string', Rule::in(ShippingQuoteCalculator::supportedZoneCodes())],
            'city_area' => ['required', 'string', 'max:150'],
            'address_line_1' => ['required', 'string', 'max:255'],
            'address_line_2' => ['nullable', 'string', 'max:255'],
            'delivery_notes' => ['nullable', 'string', 'max:3000'],
        ], [
            'emirate_code.in' => 'Delivery is not available for this emirate code.',
        ]);

        $cartItems = $request->user()->cartItems()
            ->with(['product.category:id,slug', 'product.images'])
            ->get();
        $lines = $cartItems->map(fn (CartItem $item): array => [
            'product' => $item->product,
            'quantity' => $item->quantity,
        ]);
        $quote = $quoteService->build($lines, $validated['emirate_code']);

        if ($quote === null) {
            throw ValidationException::withMessages([
                'cart' => 'Your cart has no available products to order.',
            ]);
        }

        if (! $quote['can_checkout']) {
            throw ValidationException::withMessages([
                'cart' => 'Remove unavailable products from your cart before placing the order.',
            ]);
        }

        $order = DB::transaction(function () use ($request, $validated, $cartItems, $quote): Order {
            $order = Order::create([
                'reference' => $this->newReference(),
                'user_id' => $request->user()->id,
                'customer_name' => trim($validated['customer_name']),
                'email' => trim($validated['email']),
                'phone' => trim($validated['phone']),
                'emirate_code' => $validated['emirate_code'],
                'city_area' => trim($validated['city_area']),
                'address_line_1' => trim($validated['address_line_1']),
                'address_line_2' => $this->nullableTrim($validated['address_line_2'] ?? null),
                'delivery_notes' => $this->nullableTrim($validated['delivery_notes'] ?? null),
                'status' => 'new',
                'payment_status' => 'unpaid',
                'payment_method' => 'payment_on_confirmation',
                'subtotal' => $quote['subtotal'],
                'shipping_amount' => $quote['shipping']['amount'],
                'shipping_tax' => $quote['shipping']['tax'],
                'total_amount' => $quote['total'],
                'currency' => $quote['currency'],
            ]);

            $order->items()->createMany($cartItems->map(function (CartItem $cartItem): array {
                $product = $cartItem->product;
                $unitPrice = (float) ($product->discount_price ?: $product->price);

                return [
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'product_slug' => $product->slug,
                    'product_sku' => $product->sku,
                    'product_image_path' => $product->images->first()?->path ?: $product->image_path,
                    'unit_price' => round($unitPrice, 2),
                    'quantity' => $cartItem->quantity,
                    'line_total' => round($unitPrice * $cartItem->quantity, 2),
                ];
            })->all());

            $request->user()->cartItems()->delete();

            return $order->load('items');
        });

        return response()->json([
            'message' => 'Your order has been received successfully.',
            'reference' => $order->reference,
            'order' => $order,
        ], 201);
    }

    public function index()
    {
        return response()->json(
            Order::query()
                ->with('items')
                ->latest()
                ->get()
        );
    }

    public function show(Order $order)
    {
        return response()->json($order->load('items'));
    }

    public function update(Request $request, Order $order)
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(self::STATUSES)],
            'payment_status' => ['required', Rule::in(self::PAYMENT_STATUSES)],
            'staff_note' => ['nullable', 'string', 'max:5000'],
        ]);

        $order->update([
            'status' => $validated['status'],
            'payment_status' => $validated['payment_status'],
            'staff_note' => $this->nullableTrim($validated['staff_note'] ?? null),
        ]);

        return response()->json([
            'message' => "{$order->reference} updated successfully.",
            'order' => $order->fresh()->load('items'),
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

    private function newReference(): string
    {
        do {
            $reference = 'MLO-'.now()->format('Ymd').'-'.Str::upper(Str::random(6));
        } while (Order::where('reference', $reference)->exists());

        return $reference;
    }

    private function nullableTrim(?string $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }
}
