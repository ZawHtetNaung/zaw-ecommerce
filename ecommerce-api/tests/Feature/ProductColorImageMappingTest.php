<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Color;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\SubCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProductColorImageMappingTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_can_connect_a_color_to_a_newly_uploaded_gallery_image(): void
    {
        Storage::fake('public');
        [$category, $subCategory] = $this->catalog();
        $color = Color::query()->create([
            'name' => 'Ocean Blue',
            'is_active' => true,
        ]);

        $response = $this->actingAs(User::factory()->admin()->create())->post('/api/products', [
            'category_id' => $category->id,
            'sub_category_id' => $subCategory->id,
            'name' => 'Mapped Product',
            'price' => 500,
            'stock' => 5,
            'color_ids' => [$color->id],
            'color_image_indexes' => [$color->id => 1],
            'images' => [
                UploadedFile::fake()->image('front.jpg'),
                UploadedFile::fake()->image('ocean-blue.jpg'),
            ],
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('product.colors.0.pivot.product_image_id', $response->json('product.images.1.id'));
    }

    public function test_normal_product_update_preserves_an_existing_color_image_mapping(): void
    {
        [$category, $subCategory] = $this->catalog();
        $product = $this->product($category, $subCategory, 'Preserved Mapping');
        $color = Color::query()->create([
            'name' => 'Red',
            'is_active' => true,
        ]);
        $image = ProductImage::query()->create([
            'product_id' => $product->id,
            'path' => 'products/red.jpg',
            'sort_order' => 0,
        ]);
        $product->colors()->attach($color->id, ['product_image_id' => $image->id]);

        $this->actingAs(User::factory()->admin()->create())
            ->putJson("/api/products/{$product->id}", [
                'category_id' => $category->id,
                'sub_category_id' => $subCategory->id,
                'name' => 'Preserved Mapping Updated',
                'price' => 550,
                'stock' => 4,
                'color_ids' => [$color->id],
            ])
            ->assertOk()
            ->assertJsonPath('product.colors.0.pivot.product_image_id', $image->id);

        $this->assertDatabaseHas('color_product', [
            'product_id' => $product->id,
            'color_id' => $color->id,
            'product_image_id' => $image->id,
        ]);
    }

    public function test_mapping_rejects_an_image_from_another_product(): void
    {
        [$category, $subCategory] = $this->catalog();
        $product = $this->product($category, $subCategory, 'Mapping Owner');
        $otherProduct = $this->product($category, $subCategory, 'Other Product');
        $color = Color::query()->create([
            'name' => 'Green',
            'is_active' => true,
        ]);
        $foreignImage = ProductImage::query()->create([
            'product_id' => $otherProduct->id,
            'path' => 'products/foreign.jpg',
            'sort_order' => 0,
        ]);

        $this->actingAs(User::factory()->admin()->create())
            ->putJson("/api/products/{$product->id}", [
                'category_id' => $category->id,
                'sub_category_id' => $subCategory->id,
                'name' => $product->name,
                'price' => $product->price,
                'stock' => $product->stock,
                'color_ids' => [$color->id],
                'color_image_ids' => [$color->id => $foreignImage->id],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors("color_image_ids.{$color->id}");

        $this->assertDatabaseMissing('color_product', [
            'product_id' => $product->id,
            'color_id' => $color->id,
        ]);
    }

    /**
     * @return array{Category, SubCategory}
     */
    private function catalog(): array
    {
        $category = Category::query()->create([
            'name' => 'Furniture',
            'slug' => 'furniture',
            'is_active' => true,
        ]);
        $subCategory = SubCategory::query()->create([
            'category_id' => $category->id,
            'name' => 'Tables',
            'slug' => 'tables',
            'is_active' => true,
        ]);

        return [$category, $subCategory];
    }

    private function product(
        Category $category,
        SubCategory $subCategory,
        string $name
    ): Product {
        return Product::query()->create([
            'category_id' => $category->id,
            'sub_category_id' => $subCategory->id,
            'name' => $name,
            'slug' => str($name)->slug(),
            'price' => 500,
            'stock' => 5,
            'is_in_stock' => true,
            'is_active' => true,
        ]);
    }
}
