<?php

namespace Tests\Feature;

use App\Mail\QuotationRequestReceived;
use App\Models\Category;
use App\Models\Product;
use App\Models\SubCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class QuotationRequestTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_submit_a_multi_product_quotation_and_prices_are_snapshotted_by_the_server(): void
    {
        Mail::fake();
        config()->set('quotation.notification_email', 'sales@example.com');

        [$firstProduct, $secondProduct] = $this->createProducts();

        $response = $this->postJson('/api/public/quotation-requests', [
            'customer_name' => 'Project Customer',
            'email' => 'customer@example.com',
            'phone' => '+971501234567',
            'company' => 'Example Interiors',
            'project_type' => 'commercial',
            'emirate' => 'Dubai',
            'message' => 'Please include delivery.',
            'items' => [
                [
                    'product_id' => $firstProduct->id,
                    'quantity' => 2,
                    'unit_price' => 1,
                ],
                [
                    'product_id' => $secondProduct->id,
                    'quantity' => 3,
                    'unit_price' => 1,
                ],
            ],
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('message', 'Your quotation request has been sent successfully.')
            ->assertJsonPath('quotation.status', 'new')
            ->assertJsonPath('quotation.total_amount', '470.00')
            ->assertJsonCount(2, 'quotation.items');

        $this->assertMatchesRegularExpression(
            '/^MLQ-\d{8}-[A-Z0-9]{6}$/',
            (string) $response->json('reference')
        );
        $this->assertDatabaseHas('quotation_requests', [
            'email' => 'customer@example.com',
            'total_amount' => 470,
            'status' => 'new',
        ]);
        $this->assertDatabaseHas('quotation_request_items', [
            'product_id' => $firstProduct->id,
            'quantity' => 2,
            'unit_price' => 85,
            'line_total' => 170,
        ]);

        Mail::assertSent(QuotationRequestReceived::class, function ($mail): bool {
            return $mail->hasTo('sales@example.com');
        });
    }

    public function test_authenticated_dashboard_can_update_quotation_status(): void
    {
        Mail::fake();
        config()->set('quotation.notification_email', 'sales@example.com');
        [$product] = $this->createProducts();

        $createResponse = $this->postJson('/api/public/quotation-requests', [
            'customer_name' => 'Project Customer',
            'email' => 'customer@example.com',
            'phone' => '+971501234567',
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 1,
            ]],
        ])->assertCreated();

        $quotationId = $createResponse->json('quotation.id');
        $user = User::factory()->admin()->create();
        $token = $user->createToken('quotation-test')->plainTextToken;

        $this->withToken($token)
            ->patchJson("/api/quotation-requests/{$quotationId}", [
                'status' => 'quoted',
                'staff_note' => 'Sent by email.',
            ])
            ->assertOk()
            ->assertJsonPath('quotation.status', 'quoted')
            ->assertJsonPath('quotation.staff_note', 'Sent by email.');

        $this->withToken($token)
            ->getJson('/api/quotation-requests')
            ->assertOk()
            ->assertJsonPath('0.id', $quotationId)
            ->assertJsonCount(1, '0.items');
    }

    /**
     * @return array{Product, Product}
     */
    private function createProducts(): array
    {
        $category = Category::create([
            'name' => 'Furniture',
            'slug' => 'furniture',
            'is_active' => true,
        ]);
        $subCategory = SubCategory::create([
            'category_id' => $category->id,
            'name' => 'Tables',
            'slug' => 'tables',
            'is_active' => true,
        ]);

        $firstProduct = Product::create([
            'category_id' => $category->id,
            'sub_category_id' => $subCategory->id,
            'name' => 'Quotation Table',
            'slug' => 'quotation-table',
            'sku' => 'QT-1',
            'price' => 100,
            'discount_price' => 85,
            'stock' => 0,
            'is_in_stock' => false,
            'is_active' => true,
        ]);
        $secondProduct = Product::create([
            'category_id' => $category->id,
            'sub_category_id' => $subCategory->id,
            'name' => 'Quotation Chair',
            'slug' => 'quotation-chair',
            'sku' => 'QC-1',
            'price' => 100,
            'stock' => 1,
            'is_in_stock' => true,
            'is_active' => true,
        ]);

        return [$firstProduct, $secondProduct];
    }
}
