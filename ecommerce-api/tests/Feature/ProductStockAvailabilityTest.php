<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\SubCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductStockAvailabilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_stock_switch_enforces_a_consistent_quantity(): void
    {
        $user = User::factory()->admin()->create();
        $token = $user->createToken('stock-test')->plainTextToken;
        $category = Category::create([
            'name' => 'Furniture',
            'slug' => 'furniture',
            'is_active' => true,
        ]);
        $subCategory = SubCategory::create([
            'category_id' => $category->id,
            'name' => 'Chairs',
            'slug' => 'chairs',
            'is_active' => true,
        ]);

        $basePayload = [
            'category_id' => $category->id,
            'sub_category_id' => $subCategory->id,
            'name' => 'Stock Test Chair',
            'price' => 100,
            'is_active' => true,
        ];

        // Backwards compatibility: quantity-only clients still set availability.
        $create = $this->withToken($token)->postJson('/api/products', [
            ...$basePayload,
            'stock' => 4,
        ]);

        $create
            ->assertCreated()
            ->assertJsonPath('product.stock', 4)
            ->assertJsonPath('product.is_in_stock', true);

        $productId = $create->json('product.id');

        $this->getJson('/api/public/products')
            ->assertOk()
            ->assertJsonPath('data.0.is_in_stock', true);

        // OFF is authoritative and clears any submitted quantity.
        $this->withToken($token)->putJson('/api/products/'.$productId, [
            ...$basePayload,
            'stock' => 99,
            'is_in_stock' => false,
        ])
            ->assertOk()
            ->assertJsonPath('product.stock', 0)
            ->assertJsonPath('product.is_in_stock', false);

        // ON with no quantity restores the minimum valid quantity of one.
        $this->withToken($token)->putJson('/api/products/'.$productId, [
            ...$basePayload,
            'is_in_stock' => true,
        ])
            ->assertOk()
            ->assertJsonPath('product.stock', 1)
            ->assertJsonPath('product.is_in_stock', true);
    }

    public function test_out_of_stock_cart_items_remain_visible_but_do_not_count_towards_totals(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('cart-stock-test')->plainTextToken;
        $category = Category::create([
            'name' => 'Flooring',
            'slug' => 'flooring',
            'is_active' => true,
        ]);
        $subCategory = SubCategory::create([
            'category_id' => $category->id,
            'name' => 'Wood Flooring',
            'slug' => 'wood-flooring',
            'is_active' => true,
        ]);
        $product = Product::create([
            'category_id' => $category->id,
            'sub_category_id' => $subCategory->id,
            'name' => 'Cart Stock Product',
            'slug' => 'cart-stock-product',
            'price' => 50,
            'stock' => 2,
            'is_in_stock' => true,
            'is_active' => true,
        ]);

        $add = $this->withToken($token)->postJson('/api/cart', [
            'product_id' => $product->id,
            'quantity' => 2,
        ]);

        $add
            ->assertCreated()
            ->assertJsonPath('items.0.is_available', true)
            ->assertJsonPath('count', 2)
            ->assertJsonPath('subtotal', '100.00');

        $cartItemId = $add->json('items.0.id');
        $product->update(['is_in_stock' => false]);

        $this->withToken($token)->getJson('/api/cart')
            ->assertOk()
            ->assertJsonPath('items.0.is_available', false)
            ->assertJsonPath('items.0.product.stock', 0)
            ->assertJsonPath('count', 0)
            ->assertJsonPath('subtotal', '0.00');

        $this->withToken($token)->postJson('/api/cart', [
            'product_id' => $product->id,
            'quantity' => 1,
        ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This product is currently out of stock.');

        $this->withToken($token)->patchJson('/api/cart/'.$cartItemId, ['quantity' => 1])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This product is currently out of stock.');

        $product->update([
            'is_active' => false,
            'is_in_stock' => true,
            'stock' => 2,
        ]);

        $this->withToken($token)->patchJson('/api/cart/'.$cartItemId, ['quantity' => 1])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'This product is currently out of stock.');
    }
}
