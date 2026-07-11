<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\SubCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ProductController extends Controller
{
    public function publicIndexBySubCategory(string $categorySlug, string $subCategorySlug)
    {
        $category = Category::query()
            ->select(['id', 'name', 'slug', 'description', 'image_path'])
            ->where('slug', $categorySlug)
            ->where('is_active', true)
            ->firstOrFail();

        $subCategory = SubCategory::query()
            ->select(['id', 'category_id', 'name', 'slug', 'description', 'image_path'])
            ->where('category_id', $category->id)
            ->where('slug', $subCategorySlug)
            ->where('is_active', true)
            ->withCount([
                'products as active_products_count' => fn ($query) => $query->where('is_active', true),
            ])
            ->firstOrFail();

        $products = Product::query()
            ->select([
                'id',
                'category_id',
                'sub_category_id',
                'brand_id',
                'event_id',
                'name',
                'slug',
                'price',
                'discount_price',
                'stock',
                'description',
                'image_path',
                'is_active',
                'created_at',
                'updated_at',
            ])
            ->where('category_id', $category->id)
            ->where('sub_category_id', $subCategory->id)
            ->where('is_active', true)
            ->with([
                'brand:id,name,image_path,is_active',
                'event:id,name,discount_type,discount_value,is_active,starts_at,ends_at',
                'images',
                'colors:id,name,image_path,is_active',
                'measurements:id,name,value,unit,is_active',
            ])
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'category' => $category,
            'sub_category' => $subCategory,
            'products' => $products,
        ]);
    }

    public function publicShow(string $categorySlug, string $subCategorySlug, string $productSlug)
    {
        $product = Product::query()
            ->where('slug', $productSlug)
            ->where('is_active', true)
            ->whereHas('category', fn ($query) => $query
                ->where('slug', $categorySlug)
                ->where('is_active', true)
            )
            ->whereHas('subCategory', fn ($query) => $query
                ->where('slug', $subCategorySlug)
                ->where('is_active', true)
            )
            ->with([
                'category:id,name,slug,description,image_path',
                'subCategory:id,name,slug,description,image_path,category_id',
                'brand:id,name,image_path,is_active',
                'event:id,name,discount_type,discount_value,is_active,starts_at,ends_at',
                'images',
                'colors:id,name,image_path,is_active',
                'measurements:id,name,value,unit,is_active',
            ])
            ->firstOrFail();

        return response()->json($product);
    }

    public function index()
    {
        return response()->json(
            Product::query()
                ->with([
                    'category:id,name',
                    'subCategory:id,name,category_id',
                    'brand:id,name,image_path,is_active',
                    'event:id,name,discount_type,discount_value,is_active,starts_at,ends_at',
                    'images',
                    'colors:id,name,image_path,is_active',
                    'measurements:id,name,value,unit,is_active',
                ])
                ->latest()
                ->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'sub_category_id' => ['required', 'integer'],
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'event_id' => ['nullable', 'integer', 'exists:events,id'],
            'name' => ['required', 'string', 'max:255', 'unique:products,name'],
            'price' => ['required', 'numeric', 'min:0'],
            'discount_price' => ['nullable', 'numeric', 'min:0'],
            'stock' => ['required', 'integer', 'min:0'],
            'description' => ['nullable', 'string'],
            'images' => ['nullable', 'array', 'max:8'],
            'images.*' => ['image', 'max:2048'],
            'color_ids' => ['nullable', 'array'],
            'color_ids.*' => ['integer', 'exists:colors,id'],
            'measurement_ids' => ['nullable', 'array'],
            'measurement_ids.*' => ['integer', 'exists:measurements,id'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $validated['slug'] = Str::slug($validated['name']);
        $validated['is_active'] = $validated['is_active'] ?? true;
        $request->validate([
            'sub_category_id' => [
                Rule::exists('sub_categories', 'id')->where(
                    fn ($query) => $query->where('category_id', $validated['category_id'])
                ),
            ],
        ]);

        if (Product::where('slug', $validated['slug'])->exists()) {
            $validated['slug'] = $validated['slug'].'-'.Str::random(6);
        }

        if (empty($validated['event_id']) && isset($validated['discount_price'])) {
            if ((float) $validated['discount_price'] > (float) $validated['price']) {
                return response()->json(['message' => 'Discount price cannot exceed product price.'], 422);
            }
        }

        $product = Product::create($validated);
        $product->colors()->sync($validated['color_ids'] ?? []);
        $product->measurements()->sync($validated['measurement_ids'] ?? []);
        $this->storeImages($product, $request->file('images', []));
        if (! empty($validated['event_id'])) {
            $this->applyEventDiscount($product, (int) $validated['event_id']);
        } else {
            $discountPrice = isset($validated['discount_price']) ? (float) $validated['discount_price'] : null;
            $product->update(['discount_price' => $discountPrice]);
        }
        $product->load([
            'category:id,name',
            'subCategory:id,name,category_id',
            'brand:id,name,image_path,is_active',
            'event:id,name,discount_type,discount_value,is_active,starts_at,ends_at',
            'images',
            'colors:id,name,image_path,is_active',
            'measurements:id,name,value,unit,is_active',
        ]);

        return response()->json([
            'message' => 'Product created successfully.',
            'product' => $product,
        ], 201);
    }

    public function show(Product $product)
    {
        return response()->json($product->load([
            'category:id,name',
            'subCategory:id,name,category_id',
            'brand:id,name,image_path,is_active',
            'event:id,name,discount_type,discount_value,is_active,starts_at,ends_at',
            'images',
            'colors:id,name,image_path,is_active',
            'measurements:id,name,value,unit,is_active',
        ]));
    }

    public function update(Request $request, Product $product)
    {
        $validated = $request->validate([
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'sub_category_id' => ['required', 'integer'],
            'brand_id' => ['nullable', 'integer', 'exists:brands,id'],
            'event_id' => ['nullable', 'integer', 'exists:events,id'],
            'name' => ['required', 'string', 'max:255', Rule::unique('products', 'name')->ignore($product->id)],
            'price' => ['required', 'numeric', 'min:0'],
            'discount_price' => ['nullable', 'numeric', 'min:0'],
            'stock' => ['required', 'integer', 'min:0'],
            'description' => ['nullable', 'string'],
            'images' => ['nullable', 'array', 'max:8'],
            'images.*' => ['image', 'max:2048'],
            'remove_image_ids' => ['nullable', 'array'],
            'remove_image_ids.*' => ['integer'],
            'color_ids' => ['nullable', 'array'],
            'color_ids.*' => ['integer', 'exists:colors,id'],
            'measurement_ids' => ['nullable', 'array'],
            'measurement_ids.*' => ['integer', 'exists:measurements,id'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $newSlug = Str::slug($validated['name']);
        if (
            $newSlug !== $product->slug
            && Product::where('slug', $newSlug)->where('id', '!=', $product->id)->exists()
        ) {
            $newSlug = $newSlug.'-'.Str::random(6);
        }

        $updateData = [
            'category_id' => $validated['category_id'],
            'sub_category_id' => $validated['sub_category_id'],
            'brand_id' => $validated['brand_id'] ?? null,
            'event_id' => $validated['event_id'] ?? null,
            'name' => $validated['name'],
            'slug' => $newSlug,
            'price' => $validated['price'],
            'stock' => $validated['stock'],
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'] ?? $product->is_active,
        ];
        $request->validate([
            'sub_category_id' => [
                Rule::exists('sub_categories', 'id')->where(
                    fn ($query) => $query->where('category_id', $validated['category_id'])
                ),
            ],
        ]);

        if (empty($validated['event_id']) && isset($validated['discount_price'])) {
            if ((float) $validated['discount_price'] > (float) $validated['price']) {
                return response()->json(['message' => 'Discount price cannot exceed product price.'], 422);
            }
        }

        $product->update($updateData);
        $product->colors()->sync($validated['color_ids'] ?? []);
        $product->measurements()->sync($validated['measurement_ids'] ?? []);
        $this->removeImages($product, collect($validated['remove_image_ids'] ?? []));
        $this->storeImages($product, $request->file('images', []));
        if (! empty($validated['event_id'])) {
            $this->applyEventDiscount($product, (int) $validated['event_id']);
        } else {
            $discountPrice = isset($validated['discount_price']) ? (float) $validated['discount_price'] : null;
            $product->update(['discount_price' => $discountPrice]);
        }

        return response()->json([
            'message' => 'Product updated successfully.',
            'product' => $product->fresh()->load([
                'category:id,name',
                'subCategory:id,name,category_id',
                'brand:id,name,image_path,is_active',
                'event:id,name,discount_type,discount_value,is_active,starts_at,ends_at',
                'images',
                'colors:id,name,image_path,is_active',
                'measurements:id,name,value,unit,is_active',
            ]),
        ]);
    }

    public function destroy(Product $product)
    {
        $product->load('images');
        foreach ($product->images as $image) {
            Storage::disk('public')->delete($image->path);
        }

        $product->delete();

        return response()->json([
            'message' => 'Product deleted successfully.',
        ]);
    }

    protected function storeImages(Product $product, array $images): void
    {
        if (count($images) === 0) {
            return;
        }

        $currentOrder = (int) ($product->images()->max('sort_order') ?? -1);
        foreach ($images as $image) {
            $currentOrder++;
            $path = $image->store('products', 'public');
            $product->images()->create([
                'path' => $path,
                'sort_order' => $currentOrder,
            ]);
        }
    }

    protected function removeImages(Product $product, Collection $removeImageIds): void
    {
        if ($removeImageIds->isEmpty()) {
            return;
        }

        $images = ProductImage::query()
            ->where('product_id', $product->id)
            ->whereIn('id', $removeImageIds->all())
            ->get();

        foreach ($images as $image) {
            Storage::disk('public')->delete($image->path);
            $image->delete();
        }
    }

    protected function applyEventDiscount(Product $product, int $eventId): void
    {
        $event = \App\Models\Event::find($eventId);
        if (! $event || ! $event->is_active) {
            $product->update(['discount_price' => null]);
            return;
        }

        $price = (float) $product->price;
        $discount = (float) $event->discount_value;
        if ($discount <= 0) {
            $product->update(['discount_price' => null]);
            return;
        }

        if ($event->discount_type === 'percent') {
            $discounted = max(0, $price - ($price * ($discount / 100)));
        } else {
            $discounted = max(0, $price - $discount);
        }

        $product->update(['discount_price' => $discounted]);
    }
}
