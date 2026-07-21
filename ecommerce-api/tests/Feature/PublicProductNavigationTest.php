<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\SubCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicProductNavigationTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_detail_returns_previous_and_next_products_from_the_same_subcategory(): void
    {
        $category = Category::create([
            'name' => 'Furniture',
            'slug' => 'furniture',
            'is_active' => true,
        ]);
        $chairs = SubCategory::create([
            'category_id' => $category->id,
            'name' => 'Chairs',
            'slug' => 'chairs',
            'is_active' => true,
        ]);
        $tables = SubCategory::create([
            'category_id' => $category->id,
            'name' => 'Tables',
            'slug' => 'tables',
            'is_active' => true,
        ]);

        $older = $this->createProduct($category->id, $chairs->id, 'Older Chair', 'older-chair');
        $current = $this->createProduct($category->id, $chairs->id, 'Current Chair', 'current-chair');
        $newer = $this->createProduct($category->id, $chairs->id, 'Newer Chair', 'newer-chair');
        $this->createProduct($category->id, $chairs->id, 'Hidden Chair', 'hidden-chair', false);
        $this->createProduct($category->id, $tables->id, 'Other Table', 'other-table');

        $this->getJson('/api/public/products/'.$current->slug)
            ->assertOk()
            ->assertJsonPath('navigation.previous.id', $newer->id)
            ->assertJsonPath('navigation.previous.name', 'Newer Chair')
            ->assertJsonPath('navigation.next.id', $older->id)
            ->assertJsonPath('navigation.next.name', 'Older Chair');

        $this->getJson('/api/public/products/'.$newer->slug)
            ->assertOk()
            ->assertJsonPath('navigation.previous', null)
            ->assertJsonPath('navigation.next.id', $current->id);
    }

    private function createProduct(
        int $categoryId,
        int $subCategoryId,
        string $name,
        string $slug,
        bool $isActive = true,
    ): Product {
        return Product::create([
            'category_id' => $categoryId,
            'sub_category_id' => $subCategoryId,
            'name' => $name,
            'slug' => $slug,
            'price' => 100,
            'stock' => 2,
            'is_active' => $isActive,
        ]);
    }
}
