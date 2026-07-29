<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Brand;
use App\Models\Measurement;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\SubCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductController extends Controller
{
    private const STANDARD_MEASUREMENT_NAMES = ['length', 'width', 'height', 'weight'];

    public function publicIndex(Request $request)
    {
        $perPage = min(max($request->integer('per_page', 8), 4), 32);
        $search = trim((string) $request->query('q', ''));
        $sort = (string) $request->query('sort', 'newest');

        $products = Product::query()
            ->select([
                'id',
                'category_id',
                'sub_category_id',
                'brand_id',
                'event_id',
                'name',
                'slug',
                'sku',
                'price',
                'discount_price',
                'stock',
                'is_in_stock',
                'description',
                'short_description',
                'image_path',
                'is_active',
                'created_at',
            ])
            ->where('is_active', true)
            ->whereHas('category', fn ($query) => $query->where('is_active', true))
            ->whereHas('subCategory', fn ($query) => $query->where('is_active', true))
            ->when($search !== '', function ($query) use ($search): void {
                $like = '%'.$search.'%';
                $query->where(function ($searchQuery) use ($like): void {
                    $searchQuery
                        ->where('name', 'like', $like)
                        ->orWhere('sku', 'like', $like)
                        ->orWhere('description', 'like', $like)
                        ->orWhere('short_description', 'like', $like)
                        ->orWhereHas('brand', fn ($brandQuery) => $brandQuery->where('name', 'like', $like))
                        ->orWhereHas('category', fn ($categoryQuery) => $categoryQuery->where('name', 'like', $like))
                        ->orWhereHas('subCategory', fn ($subCategoryQuery) => $subCategoryQuery->where('name', 'like', $like));
                });
            })
            ->when($request->filled('category_id'), fn ($query) => $query->where('category_id', $request->integer('category_id')))
            ->when($request->filled('brand_id'), fn ($query) => $query->where('brand_id', $request->integer('brand_id')))
            ->when($request->filled('min_price'), fn ($query) => $query->whereRaw(
                'COALESCE(NULLIF(discount_price, 0), price) >= ?',
                [(float) $request->query('min_price')]
            ))
            ->when($request->filled('max_price'), fn ($query) => $query->whereRaw(
                'COALESCE(NULLIF(discount_price, 0), price) <= ?',
                [(float) $request->query('max_price')]
            ))
            ->with([
                'category:id,name,slug',
                'subCategory:id,category_id,name,slug',
                'brand:id,name,image_path,image_alt_text,is_active',
                'event:id,name,discount_type,discount_value,is_active,starts_at,ends_at',
                'images',
                'faqs',
            ]);

        match ($sort) {
            'popular' => $products
                ->withCount([
                    'favoritedBy as favorites_count',
                    'cartItems as cart_count',
                ])
                ->orderByDesc('favorites_count')
                ->orderByDesc('cart_count')
                ->orderByDesc('id'),
            'discount' => $products
                ->whereNotNull('discount_price')
                ->where('discount_price', '>', 0)
                ->whereColumn('discount_price', '<', 'price')
                ->orderByRaw('(price - discount_price) / NULLIF(price, 0) desc')
                ->orderByDesc('id'),
            'price_asc' => $products->orderByRaw('COALESCE(NULLIF(discount_price, 0), price) asc'),
            'price_desc' => $products->orderByRaw('COALESCE(NULLIF(discount_price, 0), price) desc'),
            'name_asc' => $products->orderBy('name'),
            default => $products->orderByDesc('id'),
        };

        if ($request->has('offset')) {
            $offset = max($request->integer('offset'), 0);
            $total = (clone $products)->reorder()->count();
            $items = $products->skip($offset)->take($perPage)->get();
            $nextOffset = $offset + $items->count();

            return response()->json([
                'data' => $items,
                'current_page' => 1,
                'last_page' => max((int) ceil($total / $perPage), 1),
                'per_page' => $perPage,
                'total' => $total,
                'next_offset' => $nextOffset,
                'has_more' => $nextOffset < $total,
            ]);
        }

        return response()->json($products->paginate($perPage)->withQueryString());
    }

    public function publicFilters()
    {
        $activeProducts = fn ($query) => $query->where('is_active', true);

        return response()->json([
            'categories' => Category::query()
                ->select(['id', 'name', 'slug'])
                ->where('is_active', true)
                ->whereHas('products', $activeProducts)
                ->withCount(['products as products_count' => $activeProducts])
                ->orderBy('id')
                ->get(),
            'brands' => Brand::query()
                ->select(['id', 'name'])
                ->where('is_active', true)
                ->whereHas('products', $activeProducts)
                ->withCount(['products as products_count' => $activeProducts])
                ->orderBy('name')
                ->get(),
            'price' => [
                'min' => (float) Product::query()->where('is_active', true)->min('price'),
                'max' => (float) Product::query()->where('is_active', true)->max('price'),
            ],
        ]);
    }

    public function publicIndexBySubCategory(string $categorySlug, string $subCategorySlug)
    {
        $category = Category::query()
            ->select(['id', 'name', 'slug', 'description', 'image_path', 'image_alt_text'])
            ->where('slug', $categorySlug)
            ->where('is_active', true)
            ->firstOrFail();

        $subCategory = SubCategory::query()
            ->select(['id', 'category_id', 'name', 'slug', 'description', 'image_path', 'image_alt_text'])
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
                'is_in_stock',
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
                'brand:id,name,image_path,image_alt_text,is_active',
                'event:id,name,discount_type,discount_value,is_active,starts_at,ends_at',
                'images',
                'faqs',
                'colors:id,name,hex_code,image_path,image_alt_text,is_active',
                'measurements:id,name,value,unit,is_active',
                'sizeOptions:id,name,slug',
                'flooringDetail', 'wallpaperDetail',
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
                'brand:id,name,image_path,image_alt_text,is_active',
                'event:id,name,discount_type,discount_value,is_active,starts_at,ends_at',
                'images',
                'faqs',
                'colors:id,name,hex_code,image_path,image_alt_text,is_active',
                'measurements:id,name,value,unit,is_active',
                'sizeOptions:id,name,slug',
                'flooringDetail', 'wallpaperDetail',
            ])
            ->firstOrFail();

        return response()->json($this->withPublicProductNavigation($product));
    }

    public function publicShowBySlug(string $productSlug)
    {
        $product = Product::query()
            ->where('slug', $productSlug)
            ->where('is_active', true)
            ->with([
                'category:id,name,slug,description,image_path',
                'subCategory:id,name,slug,description,image_path,category_id',
                'brand:id,name,image_path,image_alt_text,is_active',
                'event:id,name,discount_type,discount_value,is_active,starts_at,ends_at',
                'images',
                'faqs',
                'colors:id,name,hex_code,image_path,image_alt_text,is_active',
                'measurements:id,name,value,unit,is_active',
                'sizeOptions:id,name,slug',
                'flooringDetail', 'wallpaperDetail',
            ])
            ->firstOrFail();

        return response()->json($this->withPublicProductNavigation($product));
    }

    public function index()
    {
        return response()->json(
            Product::query()
                ->with([
                    'category:id,name',
                    'subCategory:id,name,category_id',
                    'brand:id,name,image_path,image_alt_text,is_active',
                    'event:id,name,discount_type,discount_value,is_active,starts_at,ends_at',
                    'images',
                    'faqs',
                    'colors:id,name,hex_code,image_path,image_alt_text,is_active',
                    'measurements:id,name,value,unit,is_active',
                    'sizeOptions:id,name,slug',
                    'flooringDetail', 'wallpaperDetail',
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
            'product_type' => ['nullable', Rule::in(['furniture', 'flooring', 'wallpaper'])],
            'selling_method' => ['nullable', Rule::in(['per_item', 'per_square_meter', 'per_linear_meter', 'per_roll', 'per_box', 'unspecified'])],
            'physical_length' => ['nullable', 'numeric', 'min:0'], 'physical_width' => ['nullable', 'numeric', 'min:0'],
            'physical_height' => ['nullable', 'numeric', 'min:0'], 'physical_weight' => ['nullable', 'numeric', 'min:0'],
            'dimension_unit' => ['nullable', Rule::in(['mm', 'cm', 'm'])], 'weight_unit' => ['nullable', Rule::in(['g', 'kg'])],
            'flooring' => ['nullable', 'array'], 'flooring.piece_length' => ['nullable', 'numeric', 'min:0'],
            'flooring.piece_width' => ['nullable', 'numeric', 'min:0'], 'flooring.thickness' => ['nullable', 'numeric', 'min:0'],
            'flooring.coverage_per_box' => ['nullable', 'numeric', 'min:0'], 'flooring.pieces_per_box' => ['nullable', 'integer', 'min:1'],
            'flooring.minimum_order' => ['nullable', 'numeric', 'min:0'], 'flooring.waste_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'wallpaper' => ['nullable', 'array'], 'wallpaper.roll_width' => ['nullable', 'numeric', 'min:0'],
            'wallpaper.roll_length' => ['nullable', 'numeric', 'min:0'], 'wallpaper.coverage_per_roll' => ['nullable', 'numeric', 'min:0'],
            'wallpaper.pattern_repeat' => ['nullable', 'numeric', 'min:0'], 'wallpaper.match_type' => ['nullable', Rule::in(['free', 'straight', 'drop', 'reverse'])],
            'price' => ['required', 'numeric', 'min:0'],
            'discount_price' => ['nullable', 'numeric', 'min:0'],
            'stock' => ['nullable', 'integer', 'min:0'],
            'is_in_stock' => ['nullable', 'boolean'],
            'requires_paid_shipping' => ['nullable', 'boolean'],
            'description' => ['nullable', 'string'],
            'short_description' => ['nullable', 'string'],
            'seo_title' => ['nullable', 'string', 'max:255'],
            'seo_description' => ['nullable', 'string', 'max:1000'],
            'images' => ['nullable', 'array', 'max:8'],
            'images.*' => ['image', 'max:2048'],
            'image_alt_texts' => ['nullable', 'array'],
            'image_alt_texts.*' => ['nullable', 'string', 'max:255'],
            'faqs' => ['nullable', 'array'],
            'faqs.*.question' => ['required_with:faqs', 'string', 'max:1000'],
            'faqs.*.answer' => ['required_with:faqs', 'string', 'max:5000'],
            'color_ids' => ['nullable', 'array'],
            'color_ids.*' => ['integer', 'distinct', 'exists:colors,id'],
            'color_image_ids' => ['nullable', 'array'],
            'color_image_ids.*' => ['nullable', 'integer'],
            'color_image_indexes' => ['nullable', 'array'],
            'color_image_indexes.*' => ['nullable', 'integer', 'min:0'],
            'measurement_ids' => ['nullable', 'array'],
            'measurement_ids.*' => ['integer', 'exists:measurements,id'],
            'measurement_values' => ['nullable', 'array'],
            'measurement_values.*.value' => ['nullable', 'numeric', 'min:0'],
            'measurement_values.*.unit' => ['nullable', 'string', 'max:20'],
            'size_option_ids' => ['nullable', 'array'],
            'size_option_ids.*' => ['integer', 'exists:size_options,id'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $this->validateAdditionalMeasurements($validated['measurement_ids'] ?? []);

        $validated['product_type'] = $validated['product_type'] ?? 'furniture';
        $validated['selling_method'] = $validated['selling_method'] ?? 'per_item';
        $validated['dimension_unit'] = $validated['dimension_unit'] ?? 'cm';
        $validated['weight_unit'] = $validated['weight_unit'] ?? 'kg';
        $this->normalizeStockState($validated);
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

        $this->validateColorImageMappings(
            $validated,
            null,
            count($request->file('images', []))
        );

        $product = Product::create($validated);
        $this->syncMeasurements($product, $validated['measurement_ids'] ?? [], $validated['measurement_values'] ?? []);
        $this->syncSizeOptions($product, $validated['size_option_ids'] ?? []);
        $this->syncTypeDetails($product, $validated);
        $this->syncFaqs($product, $validated['faqs'] ?? []);
        $newImages = $this->storeImages($product, $request->file('images', []), $validated['image_alt_texts'] ?? []);
        $this->syncColors(
            $product,
            $validated['color_ids'] ?? [],
            $validated['color_image_ids'] ?? [],
            $validated['color_image_indexes'] ?? [],
            $newImages
        );
        if (! empty($validated['event_id'])) {
            $this->applyEventDiscount($product, (int) $validated['event_id']);
        } else {
            $discountPrice = isset($validated['discount_price']) ? (float) $validated['discount_price'] : null;
            $product->update(['discount_price' => $discountPrice]);
        }
        $product->load([
            'category:id,name',
            'subCategory:id,name,category_id',
            'brand:id,name,image_path,image_alt_text,is_active',
            'event:id,name,discount_type,discount_value,is_active,starts_at,ends_at',
            'images',
            'faqs',
            'colors:id,name,hex_code,image_path,image_alt_text,is_active',
            'measurements:id,name,value,unit,is_active',
            'sizeOptions:id,name,slug',
            'flooringDetail', 'wallpaperDetail',
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
            'brand:id,name,image_path,image_alt_text,is_active',
            'event:id,name,discount_type,discount_value,is_active,starts_at,ends_at',
            'images',
            'faqs',
            'colors:id,name,hex_code,image_path,image_alt_text,is_active',
            'measurements:id,name,value,unit,is_active',
            'sizeOptions:id,name,slug',
            'flooringDetail', 'wallpaperDetail',
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
            'product_type' => ['nullable', Rule::in(['furniture', 'flooring', 'wallpaper'])],
            'selling_method' => ['nullable', Rule::in(['per_item', 'per_square_meter', 'per_linear_meter', 'per_roll', 'per_box', 'unspecified'])],
            'physical_length' => ['nullable', 'numeric', 'min:0'], 'physical_width' => ['nullable', 'numeric', 'min:0'],
            'physical_height' => ['nullable', 'numeric', 'min:0'], 'physical_weight' => ['nullable', 'numeric', 'min:0'],
            'dimension_unit' => ['nullable', Rule::in(['mm', 'cm', 'm'])], 'weight_unit' => ['nullable', Rule::in(['g', 'kg'])],
            'flooring' => ['nullable', 'array'], 'flooring.piece_length' => ['nullable', 'numeric', 'min:0'],
            'flooring.piece_width' => ['nullable', 'numeric', 'min:0'], 'flooring.thickness' => ['nullable', 'numeric', 'min:0'],
            'flooring.coverage_per_box' => ['nullable', 'numeric', 'min:0'], 'flooring.pieces_per_box' => ['nullable', 'integer', 'min:1'],
            'flooring.minimum_order' => ['nullable', 'numeric', 'min:0'], 'flooring.waste_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'wallpaper' => ['nullable', 'array'], 'wallpaper.roll_width' => ['nullable', 'numeric', 'min:0'],
            'wallpaper.roll_length' => ['nullable', 'numeric', 'min:0'], 'wallpaper.coverage_per_roll' => ['nullable', 'numeric', 'min:0'],
            'wallpaper.pattern_repeat' => ['nullable', 'numeric', 'min:0'], 'wallpaper.match_type' => ['nullable', Rule::in(['free', 'straight', 'drop', 'reverse'])],
            'price' => ['required', 'numeric', 'min:0'],
            'discount_price' => ['nullable', 'numeric', 'min:0'],
            'stock' => ['nullable', 'integer', 'min:0'],
            'is_in_stock' => ['nullable', 'boolean'],
            'requires_paid_shipping' => ['nullable', 'boolean'],
            'description' => ['nullable', 'string'],
            'short_description' => ['nullable', 'string'],
            'seo_title' => ['nullable', 'string', 'max:255'],
            'seo_description' => ['nullable', 'string', 'max:1000'],
            'images' => ['nullable', 'array', 'max:8'],
            'images.*' => ['image', 'max:2048'],
            'image_alt_texts' => ['nullable', 'array'],
            'image_alt_texts.*' => ['nullable', 'string', 'max:255'],
            'existing_image_alt_texts' => ['nullable', 'array'],
            'existing_image_alt_texts.*' => ['nullable', 'string', 'max:255'],
            'faqs' => ['nullable', 'array'],
            'faqs.*.question' => ['required_with:faqs', 'string', 'max:1000'],
            'faqs.*.answer' => ['required_with:faqs', 'string', 'max:5000'],
            'remove_image_ids' => ['nullable', 'array'],
            'remove_image_ids.*' => ['integer'],
            'color_ids' => ['nullable', 'array'],
            'color_ids.*' => ['integer', 'distinct', 'exists:colors,id'],
            'color_image_ids' => ['nullable', 'array'],
            'color_image_ids.*' => ['nullable', 'integer'],
            'color_image_indexes' => ['nullable', 'array'],
            'color_image_indexes.*' => ['nullable', 'integer', 'min:0'],
            'measurement_ids' => ['nullable', 'array'],
            'measurement_ids.*' => ['integer', 'exists:measurements,id'],
            'measurement_values' => ['nullable', 'array'],
            'measurement_values.*.value' => ['nullable', 'numeric', 'min:0'],
            'measurement_values.*.unit' => ['nullable', 'string', 'max:20'],
            'size_option_ids' => ['nullable', 'array'],
            'size_option_ids.*' => ['integer', 'exists:size_options,id'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $this->validateAdditionalMeasurements($validated['measurement_ids'] ?? []);

        $validated['product_type'] = $validated['product_type'] ?? $product->product_type ?? 'furniture';
        $validated['selling_method'] = $validated['selling_method'] ?? $product->selling_method ?? 'per_item';
        $validated['dimension_unit'] = $validated['dimension_unit'] ?? $product->dimension_unit ?? 'cm';
        $validated['weight_unit'] = $validated['weight_unit'] ?? $product->weight_unit ?? 'kg';
        $this->normalizeStockState($validated, $product);
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
            'product_type' => $validated['product_type'], 'selling_method' => $validated['selling_method'],
            'physical_length' => $validated['physical_length'] ?? null, 'physical_width' => $validated['physical_width'] ?? null,
            'physical_height' => $validated['physical_height'] ?? null, 'physical_weight' => $validated['physical_weight'] ?? null,
            'dimension_unit' => $validated['dimension_unit'], 'weight_unit' => $validated['weight_unit'],
            'slug' => $newSlug,
            'price' => $validated['price'],
            'stock' => $validated['stock'],
            'is_in_stock' => $validated['is_in_stock'],
            'requires_paid_shipping' => $validated['requires_paid_shipping'] ?? $product->requires_paid_shipping,
            'description' => $validated['description'] ?? null,
            'short_description' => $validated['short_description'] ?? null,
            'seo_title' => $validated['seo_title'] ?? null,
            'seo_description' => $validated['seo_description'] ?? null,
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

        $this->validateColorImageMappings(
            $validated,
            $product,
            count($request->file('images', []))
        );

        $product->update($updateData);
        $this->syncMeasurements($product, $validated['measurement_ids'] ?? [], $validated['measurement_values'] ?? []);
        $this->syncSizeOptions($product, $validated['size_option_ids'] ?? []);
        $this->syncTypeDetails($product, $validated);
        $this->syncFaqs($product, $validated['faqs'] ?? []);
        $this->removeImages($product, collect($validated['remove_image_ids'] ?? []));
        foreach ($validated['existing_image_alt_texts'] ?? [] as $imageId => $altText) {
            $product->images()->whereKey($imageId)->update(['alt_text' => $altText ?: null]);
        }
        $newImages = $this->storeImages($product, $request->file('images', []), $validated['image_alt_texts'] ?? []);
        $this->syncColors(
            $product,
            $validated['color_ids'] ?? [],
            $validated['color_image_ids'] ?? [],
            $validated['color_image_indexes'] ?? [],
            $newImages
        );
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
                'brand:id,name,image_path,image_alt_text,is_active',
                'event:id,name,discount_type,discount_value,is_active,starts_at,ends_at',
                'images',
                'faqs',
                'colors:id,name,hex_code,image_path,image_alt_text,is_active',
                'measurements:id,name,value,unit,is_active',
                'sizeOptions:id,name,slug',
                'flooringDetail', 'wallpaperDetail',
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

    protected function validateColorImageMappings(
        array $validated,
        ?Product $product,
        int $newImageCount
    ): void {
        $colorIds = collect($validated['color_ids'] ?? [])
            ->map(fn (mixed $colorId): int => (int) $colorId)
            ->unique()
            ->values();
        $existingMappings = $validated['color_image_ids'] ?? [];
        $newMappings = $validated['color_image_indexes'] ?? [];
        $mappingColorIds = collect(array_keys($existingMappings))
            ->merge(array_keys($newMappings))
            ->map(fn (mixed $colorId): int => (int) $colorId)
            ->unique();
        $errors = [];

        foreach ($mappingColorIds as $colorId) {
            if (! $colorIds->contains($colorId)) {
                $errors["color_image_ids.{$colorId}"][] = 'An image can only be connected to a selected color.';
            }
        }

        $removedImageIds = collect($validated['remove_image_ids'] ?? [])
            ->map(fn (mixed $imageId): int => (int) $imageId);
        $validExistingImageIds = $product
            ? $product->images()->pluck('id')->map(fn (mixed $imageId): int => (int) $imageId)
            : collect();

        foreach ($colorIds as $colorId) {
            $hasExistingMapping = array_key_exists($colorId, $existingMappings);
            $hasNewMapping = array_key_exists($colorId, $newMappings);
            $existingImageId = $hasExistingMapping && $existingMappings[$colorId] !== null
                ? (int) $existingMappings[$colorId]
                : null;
            $newImageIndex = $hasNewMapping && $newMappings[$colorId] !== null
                ? (int) $newMappings[$colorId]
                : null;

            if ($existingImageId && $newImageIndex !== null) {
                $errors["color_image_ids.{$colorId}"][] = 'Choose either an existing image or a new upload, not both.';
            }

            if (
                $existingImageId
                && (
                    ! $validExistingImageIds->contains($existingImageId)
                    || $removedImageIds->contains($existingImageId)
                )
            ) {
                $errors["color_image_ids.{$colorId}"][] = 'The selected image must belong to this product and must not be marked for removal.';
            }

            if ($newImageIndex !== null && ($newImageIndex < 0 || $newImageIndex >= $newImageCount)) {
                $errors["color_image_indexes.{$colorId}"][] = 'The selected new image is not part of this upload.';
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * @param  array<int, int|string>  $colorIds
     * @param  array<int|string, int|null>  $existingImageMappings
     * @param  array<int|string, int|null>  $newImageMappings
     * @param  Collection<int, ProductImage>  $newImages
     */
    protected function syncColors(
        Product $product,
        array $colorIds,
        array $existingImageMappings,
        array $newImageMappings,
        Collection $newImages
    ): void {
        $currentMappings = $product->colors()
            ->get()
            ->mapWithKeys(fn ($color): array => [
                (int) $color->id => $color->pivot->product_image_id
                    ? (int) $color->pivot->product_image_id
                    : null,
            ]);
        $validImageIds = $product->images()
            ->pluck('id')
            ->map(fn (mixed $imageId): int => (int) $imageId);
        $sync = [];

        foreach (collect($colorIds)->map(fn (mixed $colorId): int => (int) $colorId)->unique() as $colorId) {
            $hasExistingMapping = array_key_exists($colorId, $existingImageMappings);
            $hasNewMapping = array_key_exists($colorId, $newImageMappings);
            $productImageId = null;

            if ($hasNewMapping && $newImageMappings[$colorId] !== null) {
                $productImageId = $newImages->get((int) $newImageMappings[$colorId])?->id;
            } elseif ($hasExistingMapping) {
                $productImageId = $existingImageMappings[$colorId] !== null
                    ? (int) $existingImageMappings[$colorId]
                    : null;
            } else {
                $currentImageId = $currentMappings->get($colorId);
                $productImageId = $currentImageId && $validImageIds->contains($currentImageId)
                    ? $currentImageId
                    : null;
            }

            $sync[$colorId] = ['product_image_id' => $productImageId];
        }

        $product->colors()->sync($sync);
    }

    /**
     * @return Collection<int, ProductImage>
     */
    protected function storeImages(Product $product, array $images, array $altTexts = []): Collection
    {
        $storedImages = collect();

        if (count($images) === 0) {
            return $storedImages;
        }

        $currentOrder = (int) ($product->images()->max('sort_order') ?? -1);
        foreach ($images as $index => $image) {
            $currentOrder++;
            $path = $image->store('products', 'public');
            $storedImages->push($product->images()->create([
                'path' => $path,
                'alt_text' => ($altTexts[$index] ?? null) ?: $product->name,
                'sort_order' => $currentOrder,
            ]));
        }

        return $storedImages;
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

    protected function syncFaqs(Product $product, array $faqs): void
    {
        $product->faqs()->delete();
        foreach (array_values($faqs) as $index => $faq) {
            $product->faqs()->create([
                'question' => trim($faq['question']),
                'answer' => trim($faq['answer']),
                'sort_order' => $index,
            ]);
        }
    }

    protected function syncMeasurements(Product $product, array $measurementIds, array $values): void
    {
        $sync = [];
        foreach ($measurementIds as $measurementId) {
            $measurementValue = $values[$measurementId] ?? [];
            $sync[$measurementId] = [
                'value' => ($measurementValue['value'] ?? '') !== '' ? $measurementValue['value'] : null,
                'unit' => ($measurementValue['unit'] ?? '') !== '' ? $measurementValue['unit'] : null,
            ];
        }
        $product->measurements()->sync($sync);
    }

    protected function validateAdditionalMeasurements(array $measurementIds): void
    {
        if ($measurementIds === []) {
            return;
        }

        $reserved = Measurement::query()
            ->whereKey(array_values(array_unique(array_map('intval', $measurementIds))))
            ->get(['id', 'name'])
            ->filter(fn (Measurement $measurement) => in_array(
                Str::lower(trim($measurement->name)),
                self::STANDARD_MEASUREMENT_NAMES,
                true
            ));

        if ($reserved->isEmpty()) {
            return;
        }

        throw ValidationException::withMessages([
            'measurement_ids' => [
                'Length, width, height, and weight must use the canonical physical or product-type fields.',
            ],
        ]);
    }

    protected function syncSizeOptions(Product $product, array $sizeOptionIds): void
    {
        $sync = [];
        foreach (array_values($sizeOptionIds) as $index => $sizeOptionId) {
            $sync[$sizeOptionId] = ['sort_order' => $index];
        }
        $product->sizeOptions()->sync($sync);
    }

    protected function syncTypeDetails(Product $product, array $validated): void
    {
        if ($validated['product_type'] === 'flooring') {
            $product->flooringDetail()->updateOrCreate([], $validated['flooring'] ?? []);
        } else {
            $product->flooringDetail()->delete();
        }
        if ($validated['product_type'] === 'wallpaper') {
            $product->wallpaperDetail()->updateOrCreate([], $validated['wallpaper'] ?? []);
        } else {
            $product->wallpaperDetail()->delete();
        }
    }

    /**
     * Keep the explicit availability switch and numeric quantity consistent.
     *
     * Older clients can continue sending only `stock`; newer clients can send
     * `is_in_stock`. Turning availability on guarantees at least one item,
     * while turning it off clears the quantity.
     */
    protected function normalizeStockState(array &$validated, ?Product $product = null): void
    {
        $hasExplicitAvailability = array_key_exists('is_in_stock', $validated)
            && $validated['is_in_stock'] !== null;
        $hasQuantity = array_key_exists('stock', $validated)
            && $validated['stock'] !== null;

        $isInStock = $hasExplicitAvailability
            ? (bool) $validated['is_in_stock']
            : ($hasQuantity
                ? (int) $validated['stock'] > 0
                : (bool) ($product?->is_in_stock ?? false));

        $quantity = $hasQuantity
            ? (int) $validated['stock']
            : (int) ($product?->stock ?? 0);

        $validated['is_in_stock'] = $isInStock;
        $validated['stock'] = $isInStock ? max(1, $quantity) : 0;
    }

    /**
     * Add lightweight previous/next links using the same newest-first order as
     * the public subcategory product listing.
     */
    protected function withPublicProductNavigation(Product $product): array
    {
        $siblings = Product::query()
            ->select(['id', 'name', 'slug'])
            ->where('is_active', true)
            ->where('category_id', $product->category_id);

        if ($product->sub_category_id === null) {
            $siblings->whereNull('sub_category_id');
        } else {
            $siblings->where('sub_category_id', $product->sub_category_id);
        }

        $previous = (clone $siblings)
            ->where('id', '>', $product->id)
            ->orderBy('id')
            ->first();
        $next = (clone $siblings)
            ->where('id', '<', $product->id)
            ->orderByDesc('id')
            ->first();

        $navigationItem = static fn (?Product $item): ?array => $item ? [
            'id' => $item->id,
            'name' => $item->name,
            'slug' => $item->slug,
        ] : null;

        return array_merge($product->toArray(), [
            'navigation' => [
                'previous' => $navigationItem($previous),
                'next' => $navigationItem($next),
            ],
        ]);
    }
}
