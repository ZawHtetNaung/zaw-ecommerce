<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Color;
use App\Models\Brand;
use App\Models\Measurement;
use App\Models\SubCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ProductApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_crud_products(): void
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
        $subCategory = SubCategory::create([
            'category_id' => $category->id,
            'name' => 'Smartphones',
            'slug' => 'smartphones',
            'description' => 'smartphones',
            'is_active' => true,
        ]);
        $color = Color::create([
            'name' => 'Red',
            'image_path' => UploadedFile::fake()->image('red.jpg')->store('colors', 'public'),
            'is_active' => true,
        ]);
        $measurement = Measurement::create([
            'name' => 'Size M',
            'unit' => 'cm',
            'value' => '40',
            'is_active' => true,
        ]);
        $brand = Brand::create([
            'name' => 'Apple',
            'slug' => 'apple',
            'is_active' => true,
        ]);

        $create = $this->withHeader('Authorization', 'Bearer '.$token)
            ->post('/api/products', [
                'category_id' => $category->id,
                'sub_category_id' => $subCategory->id,
                'name' => 'iPhone 16',
                'price' => 1299.99,
                'stock' => 25,
                'description' => 'Latest model',
                'is_active' => true,
                'brand_id' => $brand->id,
                'color_ids' => [$color->id],
                'measurement_ids' => [$measurement->id],
                'images' => [
                    UploadedFile::fake()->image('iphone-front.jpg'),
                    UploadedFile::fake()->image('iphone-back.jpg'),
                ],
            ]);

        $create
            ->assertCreated()
            ->assertJsonPath('product.name', 'iPhone 16')
            ->assertJsonPath('product.image_urls.0', fn (mixed $url) => is_string($url) && str_contains($url, '/storage/products/'));

        $productId = $create->json('product.id');
        $imageId = $create->json('product.images.0.id');

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->post('/api/products/'.$productId, [
                '_method' => 'PUT',
                'category_id' => $category->id,
                'sub_category_id' => $subCategory->id,
                'name' => 'iPhone 16 Pro',
                'price' => 1499.99,
                'stock' => 10,
                'description' => 'Updated model',
                'is_active' => true,
                'brand_id' => $brand->id,
                'color_ids' => [$color->id],
                'measurement_ids' => [$measurement->id],
                'remove_image_ids' => [$imageId],
                'images' => [UploadedFile::fake()->image('iphone-pro.jpg')],
            ])
            ->assertOk()
            ->assertJsonPath('product.name', 'iPhone 16 Pro')
            ->assertJsonPath('product.colors.0.name', 'Red')
            ->assertJsonPath('product.measurements.0.name', 'Size M')
            ->assertJsonPath('product.image_urls.0', fn (mixed $url) => is_string($url) && str_contains($url, '/storage/products/'));

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/products')
            ->assertOk()
            ->assertJsonFragment(['name' => 'iPhone 16 Pro']);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->deleteJson('/api/products/'.$productId)
            ->assertOk();
    }
}
