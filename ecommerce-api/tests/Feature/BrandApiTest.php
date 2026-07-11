<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BrandApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_crud_brands(): void
    {
        Storage::fake('public');

        $user = User::factory()->create();
        $token = $user->createToken('test_token')->plainTextToken;

        $create = $this->withHeader('Authorization', 'Bearer '.$token)
            ->post('/api/brands', [
                'name' => 'Apple',
                'image' => UploadedFile::fake()->image('apple.jpg'),
                'is_active' => true,
            ]);

        $create->assertCreated()->assertJsonPath('brand.name', 'Apple');

        $brandId = $create->json('brand.id');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->post('/api/brands/'.$brandId, [
                '_method' => 'PUT',
                'name' => 'Samsung',
                'image' => UploadedFile::fake()->image('samsung.jpg'),
                'is_active' => true,
            ])
            ->assertOk()
            ->assertJsonPath('brand.name', 'Samsung');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/brands')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Samsung']);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson('/api/brands/'.$brandId)
            ->assertOk();
    }
}
