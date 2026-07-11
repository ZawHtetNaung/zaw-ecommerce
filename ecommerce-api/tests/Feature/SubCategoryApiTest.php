<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SubCategoryApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_crud_sub_categories(): void
    {
        Storage::fake('public');

        $user = User::factory()->create();
        $token = $user->createToken('test_token')->plainTextToken;
        $category = Category::create([
            'name' => 'Electronics',
            'slug' => 'electronics',
            'description' => 'test',
            'is_active' => true,
        ]);

        $create = $this->withHeader('Authorization', 'Bearer '.$token)
            ->post('/api/sub-categories', [
                'category_id' => $category->id,
                'name' => 'Smartphones',
                'description' => 'Smartphone products',
                'is_active' => true,
                'image' => UploadedFile::fake()->image('smartphones.jpg'),
            ]);

        $create
            ->assertCreated()
            ->assertJsonPath('sub_category.name', 'Smartphones')
            ->assertJsonPath('sub_category.image_url', fn (mixed $url) => is_string($url) && str_contains($url, '/storage/sub-categories/'));

        $subCategoryId = $create->json('sub_category.id');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->post('/api/sub-categories/'.$subCategoryId, [
                '_method' => 'PUT',
                'category_id' => $category->id,
                'name' => 'Android Phones',
                'description' => 'Android only',
                'is_active' => true,
                'image' => UploadedFile::fake()->image('android.jpg'),
            ])
            ->assertOk()
            ->assertJsonPath('sub_category.name', 'Android Phones');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/sub-categories')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Android Phones']);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson('/api/sub-categories/'.$subCategoryId)
            ->assertOk();
    }
}
