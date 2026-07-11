<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Event;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EventController extends Controller
{
    public function publicIndex()
    {
        return response()->json(
            Event::query()
                ->where('is_active', true)
                ->with([
                    'products' => function ($query) {
                        $query->where('is_active', true)->with('images');
                    },
                ])
                ->orderByRaw('starts_at is null, starts_at asc')
                ->latest()
                ->get()
        );
    }

    public function index()
    {
        return response()->json(
            Event::query()
                ->withCount('products')
                ->with('products:id,name,price,discount_price,event_id')
                ->latest()
                ->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'discount_type' => ['nullable', 'string', Rule::in(['percent', 'fixed'])],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'is_active' => ['nullable', 'boolean'],
            'products' => ['nullable', 'array'],
            'products.*' => ['integer', 'exists:products,id'],
        ]);

        $discountType = $validated['discount_type'] ?? 'percent';
        $discountValue = (float) ($validated['discount_value'] ?? 0);
        if ($discountType === 'percent' && $discountValue > 100) {
            return response()->json(['message' => 'Percent discount cannot exceed 100.'], 422);
        }

        $event = Event::create([
            'name' => $validated['name'],
            'discount_type' => $discountType,
            'discount_value' => $discountValue,
            'starts_at' => $validated['starts_at'] ?? null,
            'ends_at' => $validated['ends_at'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        $productIds = collect($validated['products'] ?? []);
        if ($productIds->isNotEmpty()) {
            $products = Product::whereIn('id', $productIds)->get(['id', 'price']);
            foreach ($products as $product) {
                $discountPrice = $this->calculateDiscountPrice((float) $product->price, $event);
                $product->update([
                    'event_id' => $event->id,
                    'discount_price' => $discountPrice,
                ]);
            }
        }

        return response()->json([
            'message' => 'Event created successfully.',
            'event' => $event->load('products:id,name,price,discount_price,event_id'),
        ], 201);
    }

    public function show(Event $event)
    {
        return response()->json(
            $event->load('products:id,name,price,discount_price,event_id')
        );
    }

    public function update(Request $request, Event $event)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'discount_type' => ['nullable', 'string', Rule::in(['percent', 'fixed'])],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'is_active' => ['nullable', 'boolean'],
            'products' => ['nullable', 'array'],
            'products.*' => ['integer', 'exists:products,id'],
        ]);

        $discountType = $validated['discount_type'] ?? $event->discount_type ?? 'percent';
        $discountValue = (float) ($validated['discount_value'] ?? $event->discount_value ?? 0);
        if ($discountType === 'percent' && $discountValue > 100) {
            return response()->json(['message' => 'Percent discount cannot exceed 100.'], 422);
        }

        $event->update([
            'name' => $validated['name'],
            'discount_type' => $discountType,
            'discount_value' => $discountValue,
            'starts_at' => $validated['starts_at'] ?? null,
            'ends_at' => $validated['ends_at'] ?? null,
            'is_active' => $validated['is_active'] ?? $event->is_active,
        ]);

        $productIds = collect($validated['products'] ?? []);
        Product::where('event_id', $event->id)
            ->whereNotIn('id', $productIds->all())
            ->update(['event_id' => null, 'discount_price' => null]);
        if ($productIds->isNotEmpty()) {
            $products = Product::whereIn('id', $productIds)->get(['id', 'price']);
            foreach ($products as $product) {
                $discountPrice = $this->calculateDiscountPrice((float) $product->price, $event);
                $product->update([
                    'event_id' => $event->id,
                    'discount_price' => $discountPrice,
                ]);
            }
        }

        return response()->json([
            'message' => 'Event updated successfully.',
            'event' => $event->fresh()->load('products:id,name,price,discount_price,event_id'),
        ]);
    }

    public function destroy(Event $event)
    {
        Product::where('event_id', $event->id)->update(['event_id' => null, 'discount_price' => null]);
        $event->delete();

        return response()->json([
            'message' => 'Event deleted successfully.',
        ]);
    }

    protected function calculateDiscountPrice(float $price, Event $event): ?float
    {
        if (! $event->is_active) {
            return null;
        }

        $discount = (float) ($event->discount_value ?? 0);
        if ($discount <= 0) {
            return null;
        }

        if ($event->discount_type === 'percent') {
            $discounted = $price - ($price * ($discount / 100));
        } else {
            $discounted = $price - $discount;
        }

        return max(0, round($discounted, 2));
    }
}
