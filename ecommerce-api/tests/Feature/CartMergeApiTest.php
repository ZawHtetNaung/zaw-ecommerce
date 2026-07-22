<?php

namespace Tests\Feature;

use App\Models\CartItem;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CartMergeApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_cart_merge_requires_authentication(): void
    {
        $product = $this->product(stock: 5);

        $this->postJson('/api/cart/merge', [
            'items' => [['product_id' => $product->id, 'quantity' => 2]],
        ])->assertUnauthorized();
    }

    public function test_merge_combines_existing_and_guest_quantities_and_returns_cart_payload(): void
    {
        $user = User::factory()->create();
        $existingProduct = $this->product(stock: 10, price: 50);
        $newProduct = $this->product(stock: 10, price: 75);
        CartItem::query()->create([
            'user_id' => $user->id,
            'product_id' => $existingProduct->id,
            'quantity' => 2,
        ]);

        $this->actingAs($user)->postJson('/api/cart/merge', [
            'items' => [
                ['product_id' => $existingProduct->id, 'quantity' => 3],
                ['product_id' => $newProduct->id, 'quantity' => 2],
            ],
        ])
            ->assertOk()
            ->assertJsonCount(2, 'items')
            ->assertJsonPath('count', 7)
            ->assertJsonPath('subtotal', '400.00');

        $this->assertDatabaseHas('cart_items', [
            'user_id' => $user->id,
            'product_id' => $existingProduct->id,
            'quantity' => 5,
        ]);
        $this->assertDatabaseHas('cart_items', [
            'user_id' => $user->id,
            'product_id' => $newProduct->id,
            'quantity' => 2,
        ]);
    }

    public function test_merge_never_exceeds_current_stock_and_skips_unavailable_products(): void
    {
        $user = User::factory()->create();
        $limitedProduct = $this->product(stock: 4, price: 100);
        $inactiveProduct = $this->product(stock: 8, price: 200, active: false);
        $outOfStockProduct = $this->product(stock: 0, price: 300);
        CartItem::query()->create([
            'user_id' => $user->id,
            'product_id' => $limitedProduct->id,
            'quantity' => 3,
        ]);

        $this->actingAs($user)->postJson('/api/cart/merge', [
            'items' => [
                ['product_id' => $limitedProduct->id, 'quantity' => 4],
                ['product_id' => $inactiveProduct->id, 'quantity' => 2],
                ['product_id' => $outOfStockProduct->id, 'quantity' => 2],
                ['product_id' => 999999, 'quantity' => 2],
            ],
        ])
            ->assertOk()
            ->assertJsonCount(1, 'items')
            ->assertJsonPath('items.0.product_id', $limitedProduct->id)
            ->assertJsonPath('items.0.quantity', 4)
            ->assertJsonPath('count', 4)
            ->assertJsonPath('subtotal', '400.00');

        $this->assertDatabaseCount('cart_items', 1);
        $this->assertDatabaseHas('cart_items', [
            'user_id' => $user->id,
            'product_id' => $limitedProduct->id,
            'quantity' => 4,
        ]);
    }

    private function product(int $stock, float $price = 100, bool $active = true): Product
    {
        $category = Category::query()->firstOrCreate([
            'slug' => 'furniture',
        ], [
            'name' => 'Furniture',
            'is_active' => true,
        ]);
        $number = Product::query()->count() + 1;

        return Product::query()->create([
            'category_id' => $category->id,
            'name' => 'Merge Product '.$number,
            'slug' => 'merge-product-'.$number,
            'price' => $price,
            'stock' => $stock,
            'is_in_stock' => $stock > 0,
            'is_active' => $active,
        ]);
    }
}
