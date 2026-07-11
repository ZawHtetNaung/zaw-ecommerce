<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MeasurementApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_crud_measurements(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test_token')->plainTextToken;

        $create = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/measurements', [
                'name' => 'Size L',
                'value' => '42',
                'unit' => 'cm',
                'is_active' => true,
            ]);

        $create->assertCreated()->assertJsonPath('measurement.name', 'Size L');

        $measurementId = $create->json('measurement.id');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->putJson('/api/measurements/'.$measurementId, [
                'name' => 'Size XL',
                'value' => '44',
                'unit' => 'cm',
                'is_active' => true,
            ])
            ->assertOk()
            ->assertJsonPath('measurement.name', 'Size XL');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/measurements')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Size XL']);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson('/api/measurements/'.$measurementId)
            ->assertOk();
    }
}
