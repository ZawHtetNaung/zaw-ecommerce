<?php

namespace Tests\Feature;

use App\Models\CartItem;
use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\QuotationRequest;
use App\Models\SubCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_customer_can_place_an_order_from_the_server_cart(): void
    {
        [$customer, $product] = $this->customerWithCart();

        $response = $this->actingAs($customer)->postJson('/api/checkout/orders', [
            'customer_name' => 'Messara Customer',
            'email' => 'customer@example.com',
            'phone' => '+971501234567',
            'emirate_code' => 'dxb',
            'city_area' => 'Jumeirah',
            'address_line_1' => 'Villa 10',
            'address_line_2' => 'Street 4',
            'delivery_notes' => 'Call before delivery.',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('order.status', 'new')
            ->assertJsonPath('order.payment_status', 'unpaid')
            ->assertJsonPath('order.subtotal', '1000.00')
            ->assertJsonPath('order.shipping_amount', '350.00')
            ->assertJsonPath('order.total_amount', '1350.00')
            ->assertJsonPath('order.items.0.product_id', $product->id)
            ->assertJsonPath('order.items.0.quantity', 1);

        $this->assertDatabaseHas('orders', [
            'user_id' => $customer->id,
            'customer_name' => 'Messara Customer',
            'emirate_code' => 'DXB',
            'status' => 'new',
        ]);
        $this->assertDatabaseHas('order_items', [
            'product_id' => $product->id,
            'quantity' => 1,
            'line_total' => 1000,
        ]);
        $this->assertDatabaseMissing('cart_items', ['user_id' => $customer->id]);
    }

    public function test_order_placement_requires_authentication_and_rejects_an_unavailable_cart(): void
    {
        $this->postJson('/api/checkout/orders', [])->assertUnauthorized();

        [$customer, $product] = $this->customerWithCart();
        $product->update(['is_in_stock' => false]);

        $this->actingAs($customer)
            ->postJson('/api/checkout/orders', [
                'customer_name' => 'Messara Customer',
                'email' => 'customer@example.com',
                'phone' => '+971501234567',
                'emirate_code' => 'DXB',
                'city_area' => 'Dubai',
                'address_line_1' => 'Address',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('cart');
    }

    public function test_admin_can_manage_orders_and_notification_counts_follow_new_statuses(): void
    {
        [$customer] = $this->customerWithCart();
        $admin = User::factory()->admin()->create();
        $order = Order::query()->create([
            'reference' => 'MLO-TEST-001',
            'user_id' => $customer->id,
            'customer_name' => 'Order Customer',
            'email' => 'order@example.com',
            'phone' => '+971501234567',
            'emirate_code' => 'DXB',
            'city_area' => 'Dubai',
            'address_line_1' => 'Address',
            'status' => 'new',
            'payment_status' => 'unpaid',
            'subtotal' => 1000,
            'shipping_amount' => 350,
            'total_amount' => 1350,
            'currency' => 'AED',
        ]);
        QuotationRequest::query()->create([
            'reference' => 'MLQ-TEST-001',
            'customer_name' => 'Quote Customer',
            'email' => 'quote@example.com',
            'phone' => '+971509876543',
            'status' => 'new',
            'total_amount' => 500,
            'currency' => 'AED',
        ]);

        $this->actingAs($admin)
            ->getJson('/api/orders')
            ->assertOk()
            ->assertJsonPath('0.id', $order->id);

        $this->actingAs($admin)
            ->getJson('/api/admin-notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 2)
            ->assertJsonPath('order_count', 1)
            ->assertJsonPath('quotation_count', 1)
            ->assertJsonCount(2, 'items');

        $this->actingAs($admin)
            ->patchJson("/api/orders/{$order->id}", [
                'status' => 'confirmed',
                'payment_status' => 'pending',
                'staff_note' => 'Customer contacted.',
            ])
            ->assertOk()
            ->assertJsonPath('order.status', 'confirmed')
            ->assertJsonPath('order.payment_status', 'pending');

        $this->actingAs($admin)
            ->getJson('/api/admin-notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonPath('order_count', 0);
    }

    /**
     * @return array{User, Product}
     */
    private function customerWithCart(): array
    {
        $customer = User::factory()->create();
        $category = Category::query()->create([
            'name' => 'Furniture',
            'slug' => 'furniture',
            'is_active' => true,
        ]);
        $subCategory = SubCategory::query()->create([
            'category_id' => $category->id,
            'name' => 'Chairs',
            'slug' => 'chairs',
            'is_active' => true,
        ]);
        $product = Product::query()->create([
            'category_id' => $category->id,
            'sub_category_id' => $subCategory->id,
            'name' => 'Order Chair',
            'slug' => 'order-chair',
            'sku' => 'ORDER-CHAIR',
            'price' => 1000,
            'stock' => 5,
            'is_in_stock' => true,
            'is_active' => true,
        ]);
        CartItem::query()->create([
            'user_id' => $customer->id,
            'product_id' => $product->id,
            'quantity' => 1,
        ]);

        return [$customer, $product];
    }
}
