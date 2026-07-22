<?php

namespace App\Services;

use InvalidArgumentException;

final class ShippingQuoteCalculator
{
    public const CURRENCY = 'AED';

    private const ZONES = [
        'DXB' => ['group' => 'local', 'fee' => 35000, 'free_threshold' => 150000],
        'SHJ' => ['group' => 'local', 'fee' => 35000, 'free_threshold' => 150000],
        'AJM' => ['group' => 'local', 'fee' => 35000, 'free_threshold' => 150000],
        'AUB' => ['group' => 'extended', 'fee' => 75000, 'free_threshold' => 300000],
        'ALN' => ['group' => 'extended', 'fee' => 75000, 'free_threshold' => 300000],
        'WRN' => ['group' => 'extended', 'fee' => 75000, 'free_threshold' => 300000],
        'AAR' => ['group' => 'extended', 'fee' => 75000, 'free_threshold' => 300000],
        'HTA' => ['group' => 'extended', 'fee' => 75000, 'free_threshold' => 300000],
        'FUJ' => ['group' => 'extended', 'fee' => 75000, 'free_threshold' => 300000],
        'RAK' => ['group' => 'extended', 'fee' => 75000, 'free_threshold' => 300000],
        'UAQ' => ['group' => 'extended', 'fee' => 75000, 'free_threshold' => 300000],
    ];

    /**
     * @return list<string>
     */
    public static function supportedZoneCodes(): array
    {
        return array_keys(self::ZONES);
    }

    /**
     * All monetary inputs and internal calculations use fils (1 AED = 100 fils).
     *
     * @return array{
     *     currency: string,
     *     zone: array{code: string, group: string},
     *     shipping: array{
     *         label: string,
     *         fee_cents: int,
     *         tax_cents: int,
     *         is_free: bool,
     *         paid_shipping_override: bool,
     *         free_shipping_threshold_applies: bool,
     *         free_shipping_threshold_cents: int|null,
     *         amount_until_free_shipping_cents: int|null
     *     },
     *     total_cents: int
     * }
     */
    public function calculate(int $subtotalCents, string $zoneCode, bool $requiresPaidShipping): array
    {
        $zoneCode = strtoupper(trim($zoneCode));
        $zone = self::ZONES[$zoneCode] ?? null;

        if ($zone === null) {
            throw new InvalidArgumentException('Delivery is not available for this emirate code.');
        }

        $subtotalCents = max(0, $subtotalCents);
        $thresholdApplies = ! $requiresPaidShipping;
        $isFree = $thresholdApplies && $subtotalCents >= $zone['free_threshold'];
        $shippingFee = $isFree ? 0 : $zone['fee'];

        return [
            'currency' => self::CURRENCY,
            'zone' => [
                'code' => $zoneCode,
                'group' => $zone['group'],
            ],
            'shipping' => [
                'label' => 'Delivery',
                'fee_cents' => $shippingFee,
                'tax_cents' => 0,
                'is_free' => $isFree,
                'paid_shipping_override' => $requiresPaidShipping,
                'free_shipping_threshold_applies' => $thresholdApplies,
                'free_shipping_threshold_cents' => $thresholdApplies ? $zone['free_threshold'] : null,
                'amount_until_free_shipping_cents' => $thresholdApplies
                    ? max(0, $zone['free_threshold'] - $subtotalCents)
                    : null,
            ],
            'total_cents' => $subtotalCents + $shippingFee,
        ];
    }
}
