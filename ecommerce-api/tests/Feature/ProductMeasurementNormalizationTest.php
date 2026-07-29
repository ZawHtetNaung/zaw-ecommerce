<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Measurement;
use App\Models\SubCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductMeasurementNormalizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_standard_dimensions_cannot_be_saved_as_additional_measurements(): void
    {
        [$token, $category, $subCategory] = $this->productDependencies();
        $length = Measurement::create([
            'name' => 'Length',
            'unit' => 'cm',
            'is_active' => true,
        ]);

        $this->withToken($token)
            ->postJson('/api/products', [
                'category_id' => $category->id,
                'sub_category_id' => $subCategory->id,
                'name' => 'Canonical Dimensions Product',
                'product_type' => 'furniture',
                'physical_length' => 51,
                'dimension_unit' => 'cm',
                'price' => 499,
                'stock' => 1,
                'is_in_stock' => true,
                'measurement_ids' => [$length->id],
                'measurement_values' => [
                    $length->id => ['value' => 51, 'unit' => 'cm'],
                ],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('measurement_ids');
    }

    public function test_nonstandard_measurements_remain_available_for_product_specific_details(): void
    {
        [$token, $category, $subCategory] = $this->productDependencies();
        $seatHeight = Measurement::create([
            'name' => 'Seat height',
            'unit' => 'cm',
            'is_active' => true,
        ]);

        $response = $this->withToken($token)
            ->postJson('/api/products', [
                'category_id' => $category->id,
                'sub_category_id' => $subCategory->id,
                'name' => 'Additional Measurement Product',
                'product_type' => 'furniture',
                'physical_height' => 85,
                'dimension_unit' => 'cm',
                'price' => 699,
                'stock' => 1,
                'is_in_stock' => true,
                'measurement_ids' => [$seatHeight->id],
                'measurement_values' => [
                    $seatHeight->id => ['value' => 46, 'unit' => 'cm'],
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('product.measurements.0.name', 'Seat height')
            ->assertJsonPath(
                'product.measurements.0.pivot.value',
                fn (mixed $value) => (float) $value === 46.0
            );

        $this->assertDatabaseHas('measurement_product', [
            'product_id' => $response->json('product.id'),
            'measurement_id' => $seatHeight->id,
            'value' => 46,
            'unit' => 'cm',
        ]);
    }

    private function productDependencies(): array
    {
        $user = User::factory()->create();
        $category = Category::create([
            'name' => 'Outdoor Furniture',
            'slug' => 'outdoor-furniture',
            'is_active' => true,
        ]);
        $subCategory = SubCategory::create([
            'category_id' => $category->id,
            'name' => 'Chairs',
            'slug' => 'chairs',
            'is_active' => true,
        ]);

        return [
            $user->createToken('measurement-test')->plainTextToken,
            $category,
            $subCategory,
        ];
    }
}
