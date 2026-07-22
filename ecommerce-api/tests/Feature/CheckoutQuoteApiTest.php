<?php

namespace Tests\Feature;

use App\Models\CartItem;
use App\Models\Category;
use App\Models\Product;
use App\Models\SubCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CheckoutQuoteApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_quote_requires_authentication(): void
    {
        $this->postJson('/api/checkout/quote', ['emirate_code' => 'DXB'])
            ->assertUnauthorized();
    }

    public function test_guest_quote_does_not_require_authentication_and_uses_current_server_prices(): void
    {
        [, $product] = $this->userWithCartProduct(1000, 'furniture', 2, 800);

        $this->postJson('/api/public/checkout/quote', [
            'emirate_code' => 'dxb',
            'subtotal' => 1,
            'shipping_fee' => 0,
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 2,
                'unit_price' => 0.01,
                'line_total' => 0.02,
            ]],
        ])
            ->assertOk()
            ->assertJsonPath('can_checkout', true)
            ->assertJsonPath('zone.code', 'DXB')
            ->assertJsonPath('subtotal', '1600.00')
            ->assertJsonPath('shipping.amount', '0.00')
            ->assertJsonPath('total', '1600.00');
    }

    public function test_guest_quote_rejects_unknown_delivery_area(): void
    {
        [, $product] = $this->userWithCartProduct(1000);

        $this->postJson('/api/public/checkout/quote', [
            'emirate_code' => 'outside-uae',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('emirate_code')
            ->assertJsonPath('errors.emirate_code.0', 'Delivery is not available for this emirate code.');
    }

    public function test_guest_quote_rejects_an_empty_cart_or_a_cart_with_no_available_lines(): void
    {
        $this->postJson('/api/public/checkout/quote', [
            'emirate_code' => 'DXB',
            'items' => [],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('items');

        [, $product] = $this->userWithCartProduct(1000, 'furniture', 1, null, false);

        $this->postJson('/api/public/checkout/quote', [
            'emirate_code' => 'DXB',
            'items' => [
                ['product_id' => $product->id, 'quantity' => 1],
                ['product_id' => 999999, 'quantity' => 1],
            ],
        ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Your cart has no available items to quote.');
    }

    public function test_guest_quote_marks_stale_lines_unavailable_without_including_them_in_totals(): void
    {
        [, $availableProduct] = $this->userWithCartProduct(1000);
        [, $unavailableProduct] = $this->userWithCartProduct(5000, 'furniture', 1, null, false);

        $this->postJson('/api/public/checkout/quote', [
            'emirate_code' => 'DXB',
            'items' => [
                ['product_id' => $availableProduct->id, 'quantity' => 1],
                ['product_id' => $unavailableProduct->id, 'quantity' => 1],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('can_checkout', false)
            ->assertJsonPath('cart.available_line_count', 1)
            ->assertJsonPath('cart.unavailable_line_count', 1)
            ->assertJsonPath('subtotal', '1000.00')
            ->assertJsonPath('shipping.amount', '350.00')
            ->assertJsonPath('total', '1350.00');
    }

    public function test_guest_quote_honors_the_server_side_paid_delivery_flag(): void
    {
        $user = User::factory()->create();
        $product = $this->addCartProduct(
            $user,
            5000,
            'furniture',
            1,
            null,
            true,
            true
        );

        $this->postJson('/api/public/checkout/quote', [
            'emirate_code' => 'SHJ',
            'items' => [['product_id' => $product->id, 'quantity' => 1]],
            'requires_paid_shipping' => false,
        ])
            ->assertOk()
            ->assertJsonPath('cart.requires_paid_shipping', true)
            ->assertJsonPath('shipping.paid_shipping_override', true)
            ->assertJsonPath('shipping.free_shipping_threshold_applies', false)
            ->assertJsonPath('shipping.amount', '350.00')
            ->assertJsonPath('total', '5350.00');
    }

    public function test_unknown_zone_is_rejected_instead_of_receiving_free_shipping(): void
    {
        [$user] = $this->userWithCartProduct(5000);

        $this->actingAs($user)
            ->postJson('/api/checkout/quote', ['emirate_code' => 'unknown'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('emirate_code')
            ->assertJsonPath('errors.emirate_code.0', 'Delivery is not available for this emirate code.');
    }

    public function test_quote_uses_server_cart_prices_and_not_client_totals(): void
    {
        [$user, $product] = $this->userWithCartProduct(1000, 'furniture', 2, 800);

        $response = $this->actingAs($user)->postJson('/api/checkout/quote', [
            'emirate_code' => 'dxb',
            'subtotal' => 999999,
            'shipping_fee' => 0,
            'product_ids' => [],
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('can_checkout', true)
            ->assertJsonPath('currency', 'AED')
            ->assertJsonPath('zone.code', 'DXB')
            ->assertJsonPath('subtotal', '1600.00')
            ->assertJsonPath('shipping.label', 'Delivery')
            ->assertJsonPath('shipping.amount', '0.00')
            ->assertJsonPath('shipping.tax', '0.00')
            ->assertJsonPath('shipping.is_free', true)
            ->assertJsonPath('total', '1600.00');

        $this->assertSame('800.00', $product->discount_price);
    }

    public function test_disabled_aed_1000_rule_is_not_applied(): void
    {
        [$user] = $this->userWithCartProduct(1100);

        $this->actingAs($user)
            ->postJson('/api/checkout/quote', ['emirate_code' => 'DXB'])
            ->assertOk()
            ->assertJsonPath('subtotal', '1100.00')
            ->assertJsonPath('shipping.amount', '350.00')
            ->assertJsonPath('shipping.free_shipping_threshold', '1500.00')
            ->assertJsonPath('shipping.amount_until_free_shipping', '400.00')
            ->assertJsonPath('total', '1450.00');
    }

    public function test_special_collection_keeps_delivery_fee_above_free_threshold(): void
    {
        [$localUser] = $this->userWithCartProduct(5000, 'special-collection');
        [$extendedUser] = $this->userWithCartProduct(5000, 'special-collection');

        $this->actingAs($localUser)
            ->postJson('/api/checkout/quote', ['emirate_code' => 'SHJ'])
            ->assertOk()
            ->assertJsonPath('cart.requires_paid_shipping', true)
            ->assertJsonPath('shipping.amount', '350.00')
            ->assertJsonPath('shipping.tax', '0.00')
            ->assertJsonPath('shipping.is_free', false)
            ->assertJsonPath('shipping.paid_shipping_override', true)
            ->assertJsonPath('shipping.free_shipping_threshold_applies', false)
            ->assertJsonPath('shipping.free_shipping_threshold', null)
            ->assertJsonPath('total', '5350.00');

        $this->actingAs($extendedUser)
            ->postJson('/api/checkout/quote', ['emirate_code' => 'RAK'])
            ->assertOk()
            ->assertJsonPath('shipping.amount', '750.00')
            ->assertJsonPath('total', '5750.00');
    }

    public function test_mixed_cart_keeps_delivery_fee_when_any_item_is_special_collection(): void
    {
        [$user] = $this->userWithCartProduct(1000);
        $this->addCartProduct($user, 1000, 'outdoor', 1, null, true, true);

        $this->actingAs($user)
            ->postJson('/api/checkout/quote', ['emirate_code' => 'DXB'])
            ->assertOk()
            ->assertJsonPath('subtotal', '2000.00')
            ->assertJsonPath('cart.requires_paid_shipping', true)
            ->assertJsonPath('shipping.paid_shipping_override', true)
            ->assertJsonPath('shipping.amount', '350.00')
            ->assertJsonPath('total', '2350.00');
    }

    public function test_only_available_lines_contribute_to_quote_and_special_override(): void
    {
        [$user] = $this->userWithCartProduct(1600);
        $this->addCartProduct($user, 5000, 'special-collection', 1, null, false);

        $this->actingAs($user)
            ->postJson('/api/checkout/quote', ['emirate_code' => 'DXB'])
            ->assertOk()
            ->assertJsonPath('can_checkout', false)
            ->assertJsonPath('cart.available_line_count', 1)
            ->assertJsonPath('cart.unavailable_line_count', 1)
            ->assertJsonPath('cart.has_unavailable_items', true)
            ->assertJsonPath('cart.requires_paid_shipping', false)
            ->assertJsonPath('subtotal', '1600.00')
            ->assertJsonPath('shipping.amount', '0.00');
    }

    public function test_cart_without_available_lines_cannot_be_quoted(): void
    {
        [$user] = $this->userWithCartProduct(1000, 'furniture', 1, null, false);

        $this->actingAs($user)
            ->postJson('/api/checkout/quote', ['emirate_code' => 'DXB'])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Your cart has no available items to quote.');
    }

    /**
     * @return array{User, Product}
     */
    private function userWithCartProduct(
        float $price,
        string $categorySlug = 'furniture',
        int $quantity = 1,
        ?float $discountPrice = null,
        bool $isAvailable = true
    ): array {
        $user = User::factory()->create();
        $product = $this->addCartProduct(
            $user,
            $price,
            $categorySlug,
            $quantity,
            $discountPrice,
            $isAvailable
        );

        return [$user, $product];
    }

    private function addCartProduct(
        User $user,
        float $price,
        string $categorySlug,
        int $quantity,
        ?float $discountPrice,
        bool $isAvailable,
        bool $requiresPaidShipping = false
    ): Product {
        $category = Category::query()->firstOrCreate(
            ['slug' => $categorySlug],
            [
                'name' => str($categorySlug)->replace('-', ' ')->title()->toString(),
                'is_active' => true,
            ]
        );
        $subCategory = SubCategory::query()->create([
            'category_id' => $category->id,
            'name' => 'Products '.SubCategory::query()->count(),
            'slug' => 'products-'.SubCategory::query()->count(),
            'is_active' => true,
        ]);
        $product = Product::query()->create([
            'category_id' => $category->id,
            'sub_category_id' => $subCategory->id,
            'name' => 'Quote Product '.Product::query()->count(),
            'slug' => 'quote-product-'.Product::query()->count(),
            'price' => $price,
            'discount_price' => $discountPrice,
            'stock' => $isAvailable ? max(1, $quantity) : 0,
            'is_in_stock' => $isAvailable,
            'requires_paid_shipping' => $requiresPaidShipping,
            'is_active' => true,
        ]);

        CartItem::query()->create([
            'user_id' => $user->id,
            'product_id' => $product->id,
            'quantity' => $quantity,
        ]);

        return $product;
    }
}
