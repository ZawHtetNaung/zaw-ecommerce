<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\SubCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AiAssistantApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_gets_verified_fallback_with_matching_live_products_and_chat_is_saved(): void
    {
        config()->set('ai_assistant.api_key', null);
        $product = $this->createProduct();

        $response = $this->postJson('/api/public/ai-chat', [
            'message' => 'I need a red patio chair',
            'session_id' => '8b51f65c-eb27-49c3-8a36-f8b7584226df',
            'page_url' => 'http://localhost:5173/search',
            'history' => [],
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('session_id', '8b51f65c-eb27-49c3-8a36-f8b7584226df')
            ->assertJsonPath('provider_status', 'verified_fallback')
            ->assertJsonPath('products.0.id', $product->id)
            ->assertJsonPath('products.0.name', 'Red Patio Chair')
            ->assertJsonPath('products.0.price', '425.00')
            ->assertJsonPath('products.0.is_in_stock', true);

        $this->assertDatabaseHas('ai_chat_sessions', [
            'uuid' => '8b51f65c-eb27-49c3-8a36-f8b7584226df',
        ]);
        $this->assertDatabaseCount('ai_chat_messages', 2);
        $this->assertDatabaseHas('ai_chat_messages', [
            'role' => 'user',
            'content' => 'I need a red patio chair',
        ]);
    }

    public function test_guest_gets_exact_delivery_rules_without_an_ai_key(): void
    {
        config()->set('ai_assistant.api_key', null);

        $this->postJson('/api/public/ai-chat', [
            'message' => 'How much is delivery in Dubai?',
        ])
            ->assertOk()
            ->assertJsonPath('provider_status', 'verified_fallback')
            ->assertJsonPath('handoff', false)
            ->assertJsonCount(0, 'products')
            ->assertJsonPath('answer', fn (string $answer): bool => str_contains($answer, 'AED 350')
                && str_contains($answer, 'AED 1,500')
                && str_contains($answer, 'AED 750')
                && str_contains($answer, 'AED 3,000'));
    }

    public function test_openai_responses_api_is_called_server_side_when_configured(): void
    {
        config()->set('ai_assistant.api_key', 'server-side-test-key');
        config()->set('ai_assistant.endpoint', 'https://api.openai.com/v1/responses');
        config()->set('ai_assistant.model', 'gpt-5.6-luna');

        Http::fake([
            'https://api.openai.com/v1/responses' => Http::response([
                'output' => [[
                    'type' => 'message',
                    'content' => [[
                        'type' => 'output_text',
                        'text' => 'I can help you choose the right collection.',
                    ]],
                ]],
            ]),
        ]);

        $this->postJson('/api/public/ai-chat', [
            'message' => 'Can you help with flooring?',
            'session_id' => 'c00e0921-86ca-4705-a088-706fbcb62d69',
        ])
            ->assertOk()
            ->assertJsonPath('provider_status', 'ai')
            ->assertJsonPath('answer', 'I can help you choose the right collection.');

        Http::assertSent(function (Request $request): bool {
            return $request->url() === 'https://api.openai.com/v1/responses'
                && $request->hasHeader('Authorization', 'Bearer server-side-test-key')
                && $request['model'] === 'gpt-5.6-luna'
                && $request['store'] === false
                && is_string($request['safety_identifier'])
                && strlen($request['safety_identifier']) === 64;
        });
    }

    public function test_authenticated_dashboard_can_manage_ai_knowledge(): void
    {
        $user = User::factory()->admin()->create();
        $token = $user->createToken('ai-knowledge-test')->plainTextToken;

        $create = $this->withToken($token)->postJson('/api/ai-knowledge', [
            'title' => 'Trade customers',
            'topic' => 'services',
            'content' => 'Trade customers can request a project quotation.',
            'sort_order' => 95,
            'is_active' => true,
        ]);

        $create
            ->assertCreated()
            ->assertJsonPath('entry.title', 'Trade customers');

        $entryId = $create->json('entry.id');

        $this->withToken($token)->putJson("/api/ai-knowledge/{$entryId}", [
            'title' => 'Trade and project customers',
            'topic' => 'services',
            'content' => 'Trade and project customers can request a quotation.',
            'sort_order' => 96,
            'is_active' => true,
        ])
            ->assertOk()
            ->assertJsonPath('entry.title', 'Trade and project customers');

        $this->withToken($token)
            ->deleteJson("/api/ai-knowledge/{$entryId}")
            ->assertOk();

        $this->assertDatabaseMissing('ai_knowledge_entries', ['id' => $entryId]);
    }

    private function createProduct(): Product
    {
        $category = Category::query()->create([
            'name' => 'Outdoor Furniture',
            'slug' => 'outdoor-furniture',
            'is_active' => true,
        ]);
        $subCategory = SubCategory::query()->create([
            'category_id' => $category->id,
            'name' => 'Outdoor Chairs',
            'slug' => 'outdoor-chairs',
            'is_active' => true,
        ]);

        return Product::query()->create([
            'category_id' => $category->id,
            'sub_category_id' => $subCategory->id,
            'name' => 'Red Patio Chair',
            'slug' => 'red-patio-chair',
            'sku' => 'RPC-01',
            'price' => 500,
            'discount_price' => 425,
            'stock' => 3,
            'is_in_stock' => true,
            'short_description' => 'A red outdoor chair for patios and balconies.',
            'is_active' => true,
        ]);
    }
}
