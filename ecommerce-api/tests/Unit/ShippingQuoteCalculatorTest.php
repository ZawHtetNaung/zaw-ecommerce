<?php

namespace Tests\Unit;

use App\Services\ShippingQuoteCalculator;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class ShippingQuoteCalculatorTest extends TestCase
{
    #[DataProvider('paidZoneProvider')]
    public function test_it_charges_the_legacy_fee_below_each_zone_threshold(
        string $zoneCode,
        int $subtotalCents,
        string $zoneGroup,
        int $expectedFeeCents,
        int $expectedThresholdCents
    ): void {
        $quote = (new ShippingQuoteCalculator)->calculate($subtotalCents, $zoneCode, false);

        $this->assertSame($zoneGroup, $quote['zone']['group']);
        $this->assertSame($expectedFeeCents, $quote['shipping']['fee_cents']);
        $this->assertSame($expectedThresholdCents, $quote['shipping']['free_shipping_threshold_cents']);
        $this->assertFalse($quote['shipping']['is_free']);
        $this->assertSame($subtotalCents + $expectedFeeCents, $quote['total_cents']);
    }

    public static function paidZoneProvider(): array
    {
        return [
            'Dubai below AED 1,500' => ['DXB', 149999, 'local', 35000, 150000],
            'Sharjah below AED 1,500' => ['SHJ', 100000, 'local', 35000, 150000],
            'Ajman below AED 1,500' => ['AJM', 100000, 'local', 35000, 150000],
            'Abu Dhabi code below AED 3,000' => ['AUB', 299999, 'extended', 75000, 300000],
            'Al Ain below AED 3,000' => ['ALN', 200000, 'extended', 75000, 300000],
            'Western Region below AED 3,000' => ['WRN', 200000, 'extended', 75000, 300000],
            'AAR below AED 3,000' => ['AAR', 200000, 'extended', 75000, 300000],
            'Hatta below AED 3,000' => ['HTA', 200000, 'extended', 75000, 300000],
            'Fujairah below AED 3,000' => ['FUJ', 200000, 'extended', 75000, 300000],
            'Ras Al Khaimah below AED 3,000' => ['RAK', 200000, 'extended', 75000, 300000],
            'Umm Al Quwain below AED 3,000' => ['UAQ', 200000, 'extended', 75000, 300000],
        ];
    }

    #[DataProvider('freeZoneProvider')]
    public function test_it_grants_free_shipping_only_at_the_correct_threshold(
        string $zoneCode,
        int $subtotalCents
    ): void {
        $quote = (new ShippingQuoteCalculator)->calculate($subtotalCents, $zoneCode, false);

        $this->assertTrue($quote['shipping']['is_free']);
        $this->assertSame(0, $quote['shipping']['fee_cents']);
        $this->assertSame(0, $quote['shipping']['amount_until_free_shipping_cents']);
        $this->assertSame($subtotalCents, $quote['total_cents']);
    }

    public static function freeZoneProvider(): array
    {
        return [
            'local threshold' => ['DXB', 150000],
            'extended threshold' => ['RAK', 300000],
        ];
    }

    #[DataProvider('specialCollectionProvider')]
    public function test_special_collection_always_keeps_the_zone_fee(
        string $zoneCode,
        int $subtotalCents,
        int $expectedFeeCents
    ): void {
        $quote = (new ShippingQuoteCalculator)->calculate($subtotalCents, $zoneCode, true);

        $this->assertSame($expectedFeeCents, $quote['shipping']['fee_cents']);
        $this->assertFalse($quote['shipping']['is_free']);
        $this->assertTrue($quote['shipping']['paid_shipping_override']);
        $this->assertFalse($quote['shipping']['free_shipping_threshold_applies']);
        $this->assertNull($quote['shipping']['free_shipping_threshold_cents']);
        $this->assertNull($quote['shipping']['amount_until_free_shipping_cents']);
        $this->assertSame(0, $quote['shipping']['tax_cents']);
    }

    public static function specialCollectionProvider(): array
    {
        return [
            'local special collection' => ['DXB', 500000, 35000],
            'extended special collection' => ['FUJ', 500000, 75000],
        ];
    }

    public function test_it_never_treats_an_unsupported_zone_as_free(): void
    {
        $this->expectException(InvalidArgumentException::class);

        (new ShippingQuoteCalculator)->calculate(99999999, 'XXX', false);
    }
}
