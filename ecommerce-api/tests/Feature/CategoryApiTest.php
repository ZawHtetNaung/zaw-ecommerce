<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CategoryApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_crud_categories(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test_token')->plainTextToken;

        $create = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/categories', [
                'name' => 'Electronics',
                'description' => 'Electronic products',
                'is_active' => true,
            ]);

        $create->assertCreated()->assertJsonPath('category.name', 'Electronics');

        $categoryId = $create->json('category.id');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/categories/'.$categoryId, [
                'name' => 'Phones',
                'description' => 'Smartphones and accessories',
                'is_active' => true,
            ])
            ->assertOk()
            ->assertJsonPath('category.name', 'Phones');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/categories')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Phones']);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson('/api/categories/'.$categoryId)
            ->assertOk();
    }
}
