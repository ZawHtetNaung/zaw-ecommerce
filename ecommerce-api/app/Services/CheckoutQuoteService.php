<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Collection;

final class CheckoutQuoteService
{
    public function __construct(private readonly ShippingQuoteCalculator $calculator) {}

    /**
     * @param  Collection<int, array{product: Product|null, quantity: int}>  $lines
     * @return array<string, mixed>|null
     */
    public function build(Collection $lines, string $zoneCode): ?array
    {
        $availableLines = $lines->filter(function (array $line): bool {
            $product = $line['product'];

            return $product instanceof Product
                && $product->is_active
                && $product->is_in_stock
                && $product->stock >= $line['quantity'];
        });

        if ($availableLines->isEmpty()) {
            return null;
        }

        $subtotalCents = (int) $availableLines->sum(function (array $line): int {
            $unitPrice = $line['product']->discount_price ?: $line['product']->price;

            return $this->moneyToCents($unitPrice) * $line['quantity'];
        });

        $requiresPaidShipping = $availableLines->contains(function (array $line): bool {
            $product = $line['product'];

            return $product->requires_paid_shipping
                || $product->category?->slug === 'special-collection';
        });

        $quote = $this->calculator->calculate(
            $subtotalCents,
            $zoneCode,
            $requiresPaidShipping
        );
        $hasUnavailableItems = $lines->count() !== $availableLines->count();

        return [
            'can_checkout' => ! $hasUnavailableItems,
            'currency' => $quote['currency'],
            'zone' => $quote['zone'],
            'cart' => [
                'available_line_count' => $availableLines->count(),
                'available_item_count' => $availableLines->sum('quantity'),
                'unavailable_line_count' => $lines->count() - $availableLines->count(),
                'has_unavailable_items' => $hasUnavailableItems,
                'requires_paid_shipping' => $requiresPaidShipping,
            ],
            'subtotal' => $this->formatMoney($subtotalCents),
            'shipping' => [
                'label' => $quote['shipping']['label'],
                'amount' => $this->formatMoney($quote['shipping']['fee_cents']),
                'tax' => $this->formatMoney($quote['shipping']['tax_cents']),
                'is_free' => $quote['shipping']['is_free'],
                'paid_shipping_override' => $quote['shipping']['paid_shipping_override'],
                'free_shipping_threshold_applies' => $quote['shipping']['free_shipping_threshold_applies'],
                'free_shipping_threshold' => $this->formatNullableMoney(
                    $quote['shipping']['free_shipping_threshold_cents']
                ),
                'amount_until_free_shipping' => $this->formatNullableMoney(
                    $quote['shipping']['amount_until_free_shipping_cents']
                ),
            ],
            'total' => $this->formatMoney($quote['total_cents']),
        ];
    }

    private function moneyToCents(mixed $amount): int
    {
        $normalized = number_format((float) $amount, 2, '.', '');
        [$whole, $fraction] = explode('.', $normalized, 2);

        return ((int) $whole * 100) + (int) $fraction;
    }

    private function formatMoney(int $amountCents): string
    {
        return number_format($amountCents / 100, 2, '.', '');
    }

    private function formatNullableMoney(?int $amountCents): ?string
    {
        return $amountCents === null ? null : $this->formatMoney($amountCents);
    }
}
