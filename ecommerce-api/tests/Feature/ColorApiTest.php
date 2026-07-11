<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ColorApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_crud_colors(): void
    {
        Storage::fake('public');

        $user = User::factory()->create();
        $token = $user->createToken('test_token')->plainTextToken;

        $create = $this->withHeader('Authorization', 'Bearer '.$token)
            ->post('/api/colors', [
                'name' => 'Blue',
                'image' => UploadedFile::fake()->image('blue.jpg'),
                'is_active' => true,
            ]);

        $create->assertCreated()->assertJsonPath('color.name', 'Blue');

        $colorId = $create->json('color.id');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->post('/api/colors/'.$colorId, [
                '_method' => 'PUT',
                'name' => 'Navy',
                'image' => UploadedFile::fake()->image('navy.jpg'),
                'is_active' => true,
            ])
            ->assertOk()
            ->assertJsonPath('color.name', 'Navy');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/colors')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Navy']);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson('/api/colors/'.$colorId)
            ->assertOk();
    }
}
