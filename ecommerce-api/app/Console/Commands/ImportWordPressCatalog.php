<?php

namespace App\Console\Commands;

use App\Models\Banner;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Color;
use App\Models\Measurement;
use App\Models\Product;
use App\Models\SubCategory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Throwable;

class ImportWordPressCatalog extends Command
{
    protected $signature = 'wordpress:import-catalog
        {--database=i8055463_wp1 : Canonical WordPress MySQL database}
        {--uploads= : Absolute path to wp-content/uploads}
        {--url=https://www.messaraliving.com : Original site URL}
        {--banners-only : Import only the current Revolution Slider banners}
        {--taxonomy-only : Import only categories and their images}
        {--brands-only : Import only brands, logos, and product relationships}
        {--dry-run : Inspect and report without writing}';

    protected $description = 'Import a clean product catalog and original media from WooCommerce';

    public function handle(): int
    {
        $uploads = rtrim((string) $this->option('uploads'), "\\/");
        if ($uploads === '' || ! is_dir($uploads)) {
            $this->error('Pass a valid --uploads path.');
            return self::FAILURE;
        }

        $this->configureSourceConnection((string) $this->option('database'));

        try {
            $productCount = DB::connection('wordpress')->table('wp_posts')
                ->where('post_type', 'product')->whereIn('post_status', ['publish', 'private', 'draft'])->count();
        } catch (Throwable $e) {
            $this->error('Cannot read WordPress staging database: '.$e->getMessage());
            return self::FAILURE;
        }

        $this->info("Found {$productCount} WooCommerce products.");
        if ($this->option('dry-run')) {
            return self::SUCCESS;
        }
        if ($this->option('banners-only')) {
            $this->info('Imported '.$this->importBanners($uploads).' current Messara Living banners.');
            return self::SUCCESS;
        }
        if ($this->option('taxonomy-only')) {
            $this->info('Imported '.count($this->importCategories($uploads)).' category mappings and images.');
            return self::SUCCESS;
        }

        $brandMap = $this->importBrands($uploads);
        if ($this->option('brands-only')) {
            $this->attachBrands($brandMap);
            $this->info('Imported '.Brand::count().' brands and attached them to products.');
            return self::SUCCESS;
        }

        $categoryMap = $this->importCategories($uploads);
        $specialCollectionTermIds = DB::connection('wordpress')->table('wp_terms as terms')
            ->join('wp_term_taxonomy as taxonomy', 'taxonomy.term_id', '=', 'terms.term_id')
            ->where('taxonomy.taxonomy', 'product_cat')
            ->where('terms.slug', 'special-collection')
            ->distinct()
            ->pluck('terms.term_id')
            ->map(fn ($termId) => (int) $termId)
            ->all();
        $fallback = Category::firstOrCreate(
            ['slug' => 'uncategorized'],
            ['name' => 'Uncategorized', 'is_active' => true]
        );

        $bar = $this->output->createProgressBar($productCount);
        $bar->start();
        $imported = 0;
        $missingImages = 0;

        DB::connection('wordpress')->table('wp_posts')
            ->where('post_type', 'product')
            ->whereIn('post_status', ['publish', 'private', 'draft'])
            ->orderBy('ID')
            ->chunkById(100, function ($posts) use ($uploads, $categoryMap, $brandMap, $specialCollectionTermIds, $fallback, $bar, &$imported, &$missingImages) {
                $ids = $posts->pluck('ID')->map(fn ($id) => (int) $id)->all();
                $meta = $this->metaFor('wp_postmeta', 'post_id', $ids);
                $terms = $this->productCategoryTerms($ids);
                $colorTerms = $this->productColorTerms($ids);
                $brandTerms = $this->productBrandTerms($ids);

                $attachmentIds = [];
                foreach ($ids as $id) {
                    $attachmentIds[] = (int) ($meta[$id]['_thumbnail_id'] ?? 0);
                    foreach (explode(',', (string) ($meta[$id]['_product_image_gallery'] ?? '')) as $galleryId) {
                        $attachmentIds[] = (int) $galleryId;
                    }
                }
                $attachmentIds = array_values(array_filter(array_unique($attachmentIds)));
                $attachmentMeta = $this->metaFor('wp_postmeta', 'post_id', $attachmentIds);

                foreach ($posts as $post) {
                    $id = (int) $post->ID;
                    $postMeta = $meta[$id] ?? [];
                    $regular = $this->money($postMeta['_regular_price'] ?? $postMeta['_price'] ?? 0);
                    $sale = $this->money($postMeta['_sale_price'] ?? null);
                    $stockQuantity = max(0, (int) ($postMeta['_stock'] ?? 0));
                    $stockStatus = strtolower(trim((string) ($postMeta['_stock_status'] ?? '')));
                    $isInStock = match ($stockStatus) {
                        'instock' => true,
                        'outofstock' => false,
                        default => $stockQuantity > 0,
                    };
                    $categoryId = $fallback->id;
                    $subCategoryId = null;
                    $productTerms = $terms[$id] ?? [];
                    usort($productTerms, fn ($a, $b) => (int) ($categoryMap[$b]['sub_category_id'] ?? 0) <=> (int) ($categoryMap[$a]['sub_category_id'] ?? 0));
                    foreach ($productTerms as $termId) {
                        if (isset($categoryMap[$termId])) {
                            $categoryId = $categoryMap[$termId]['category_id'];
                            $subCategoryId = $categoryMap[$termId]['sub_category_id'];
                            break;
                        }
                    }

                    $slug = $this->uniqueSlug((string) $post->post_name, $id);
                    $product = Product::updateOrCreate(
                        ['wordpress_id' => $id],
                        [
                            'category_id' => $categoryId,
                            'sub_category_id' => $subCategoryId,
                            'brand_id' => isset($brandTerms[$id][0]) ? ($brandMap[$brandTerms[$id][0]] ?? null) : null,
                            'name' => html_entity_decode((string) $post->post_title, ENT_QUOTES | ENT_HTML5, 'UTF-8'),
                            'slug' => $slug,
                            'sku' => $this->nullable($postMeta['_sku'] ?? null),
                            'price' => $regular,
                            'discount_price' => $sale !== null && $sale < $regular ? $sale : null,
                            'stock' => $isInStock ? max(1, $stockQuantity) : 0,
                            'is_in_stock' => $isInStock,
                            'requires_paid_shipping' => count(array_intersect($productTerms, $specialCollectionTermIds)) > 0,
                            'description' => $this->nullable($post->post_content),
                            'short_description' => $this->nullable(html_entity_decode(strip_tags((string) $post->post_excerpt), ENT_QUOTES | ENT_HTML5, 'UTF-8')),
                            'seo_title' => $this->nullable($postMeta['_yoast_wpseo_title'] ?? $postMeta['rank_math_title'] ?? null),
                            'seo_description' => $this->nullable($postMeta['_yoast_wpseo_metadesc'] ?? $postMeta['rank_math_description'] ?? null),
                            'source_url' => rtrim((string) $this->option('url'), '/').'/product/'.$slug.'/',
                            'is_active' => $post->post_status === 'publish',
                        ]
                    );

                    $imageIds = [(int) ($postMeta['_thumbnail_id'] ?? 0)];
                    $imageIds = array_merge($imageIds, array_map('intval', array_filter(explode(',', (string) ($postMeta['_product_image_gallery'] ?? '')))));
                    $imageIds = array_values(array_filter(array_unique($imageIds)));
                    $product->images()->delete();
                    foreach ($imageIds as $order => $attachmentId) {
                        $relative = $attachmentMeta[$attachmentId]['_wp_attached_file'] ?? null;
                        if (! $relative) {
                            continue;
                        }
                        $stored = $this->copyMedia($uploads, (string) $relative, 'products', $attachmentId);
                        if ($stored === null) {
                            $missingImages++;
                            continue;
                        }
                        $product->images()->create(['path' => $stored, 'sort_order' => $order]);
                    }
                    $product->update(['image_path' => $product->images()->value('path')]);
                    $this->syncColors($product, $colorTerms[$id] ?? [], $uploads);
                    $this->syncPhysicalMeasurements($product, $postMeta);
                    $imported++;
                    $bar->advance();
                }
            }, 'ID');

        $bar->finish();
        $this->newLine(2);
        $this->call('wordpress:classify-product-types', ['--database' => $this->option('database'), '--apply' => true]);
        $this->call('wordpress:map-specifications', ['--database' => $this->option('database')]);
        $this->call('wordpress:map-sizes', ['--database' => $this->option('database')]);
        $this->call('wordpress:map-color-images', ['--database' => $this->option('database'), '--uploads' => $uploads]);
        $this->call('wordpress:rebuild-canonical-content', ['--database' => $this->option('database'), '--apply' => true]);
        $this->info("Imported {$imported} products; {$missingImages} referenced images were not found.");
        $bannerCount = $this->importBanners($uploads);
        $this->info("Imported {$bannerCount} current Messara Living banners.");
        return self::SUCCESS;
    }

    private function configureSourceConnection(string $database): void
    {
        $base = config('database.connections.mysql');
        $base['database'] = $database;
        config(['database.connections.wordpress' => $base]);
        DB::purge('wordpress');
    }

    private function importBrands(string $uploads): array
    {
        $rows = DB::connection('wordpress')->table('wp_terms as t')
            ->join('wp_term_taxonomy as tt', 'tt.term_id', '=', 't.term_id')
            ->leftJoin('wp_termmeta as image_meta', function ($join) {
                $join->on('image_meta.term_id', '=', 't.term_id')->where('image_meta.meta_key', 'image');
            })
            ->where('tt.taxonomy', 'pa_brand')
            ->select('t.term_id', 't.name', 't.slug', 'tt.count', 'image_meta.meta_value as image')
            ->orderByDesc('tt.count')
            ->get();
        $map = [];
        $bySlug = [];
        foreach ($rows as $row) {
            $termId = (int) $row->term_id;
            $slug = Str::slug((string) $row->slug) ?: 'brand-'.$termId;
            if (isset($bySlug[$slug])) {
                $map[$termId] = $bySlug[$slug];
                continue;
            }
            $brand = Brand::updateOrCreate(
                ['slug' => $slug],
                [
                    'wordpress_id' => $termId,
                    'name' => html_entity_decode((string) $row->name, ENT_QUOTES | ENT_HTML5, 'UTF-8'),
                    'source_url' => rtrim((string) $this->option('url'), '/').'/brand/'.$slug.'/',
                    'is_active' => (int) $row->count > 0,
                ]
            );
            if (is_string($row->image) && str_contains($row->image, '/wp-content/uploads/')) {
                $relative = urldecode(Str::after($row->image, '/wp-content/uploads/'));
                $brand->update(['image_path' => $this->copyMedia($uploads, $relative, 'brands', $termId)]);
            }
            $bySlug[$slug] = $brand->id;
            $map[$termId] = $brand->id;
        }
        return $map;
    }

    private function productBrandTerms(array $productIds): array
    {
        if ($productIds === []) {
            return [];
        }
        $rows = DB::connection('wordpress')->table('wp_term_relationships as tr')
            ->join('wp_term_taxonomy as tt', 'tt.term_taxonomy_id', '=', 'tr.term_taxonomy_id')
            ->where('tt.taxonomy', 'pa_brand')
            ->whereIn('tr.object_id', $productIds)
            ->select('tr.object_id', 'tt.term_id')->get();
        $result = [];
        foreach ($rows as $row) {
            $result[(int) $row->object_id][] = (int) $row->term_id;
        }
        return $result;
    }

    private function attachBrands(array $brandMap): void
    {
        Product::whereNotNull('wordpress_id')->update(['brand_id' => null]);
        $rows = DB::connection('wordpress')->table('wp_term_relationships as tr')
            ->join('wp_term_taxonomy as tt', 'tt.term_taxonomy_id', '=', 'tr.term_taxonomy_id')
            ->where('tt.taxonomy', 'pa_brand')
            ->select('tr.object_id', 'tt.term_id')->orderBy('tr.object_id')->get();
        $attached = [];
        foreach ($rows as $row) {
            $wordpressId = (int) $row->object_id;
            if (isset($attached[$wordpressId], $brandMap[(int) $row->term_id])) {
                continue;
            }
            if (isset($brandMap[(int) $row->term_id])) {
                Product::where('wordpress_id', $wordpressId)->update(['brand_id' => $brandMap[(int) $row->term_id]]);
                $attached[$wordpressId] = true;
            }
        }
    }

    private function importCategories(string $uploads): array
    {
        $rows = DB::connection('wordpress')->table('wp_terms as t')
            ->join('wp_term_taxonomy as tt', 'tt.term_id', '=', 't.term_id')
            ->where('tt.taxonomy', 'product_cat')
            ->select('t.term_id', 't.name', 't.slug', 'tt.description', 'tt.parent', 'tt.count')
            ->get();
        $termMeta = $this->metaFor('wp_termmeta', 'term_id', $rows->pluck('term_id')->map(fn ($id) => (int) $id)->all());
        $attachmentIds = $rows->map(fn ($row) => (int) ($termMeta[(int) $row->term_id]['thumbnail_id'] ?? 0))->filter()->unique()->values()->all();
        $attachmentMeta = $this->metaFor('wp_postmeta', 'post_id', $attachmentIds);
        $map = [];
        $byId = $rows->keyBy(fn ($row) => (int) $row->term_id);
        $rootCategoryIds = [];

        foreach ($rows->sortBy(fn ($row) => (int) $row->parent === 0 ? 0 : 1) as $row) {
            $termId = (int) $row->term_id;
            $rootId = $termId;
            $seen = [];
            while (isset($byId[$rootId]) && (int) $byId[$rootId]->parent !== 0 && ! isset($seen[$rootId])) {
                $seen[$rootId] = true;
                $rootId = (int) $byId[$rootId]->parent;
            }
            $root = $byId[$rootId] ?? $row;
            if (! isset($rootCategoryIds[$rootId])) {
                $rootSlug = Str::slug((string) $root->slug) ?: 'category-'.$rootId;
                $rootName = html_entity_decode((string) $root->name, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                $category = Category::updateOrCreate(
                    ['wordpress_id' => $rootId],
                    [
                        'name' => $rootName,
                        'slug' => $rootSlug,
                        'description' => $this->nullable($root->description),
                        'source_url' => rtrim((string) $this->option('url'), '/').'/product-category/'.$rootSlug.'/',
                        'is_active' => (int) $root->count > 0,
                    ]
                );
                $rootAttachmentId = (int) ($termMeta[$rootId]['thumbnail_id'] ?? 0);
                $rootRelative = $attachmentMeta[$rootAttachmentId]['_wp_attached_file'] ?? null;
                if ($rootRelative) {
                    $category->update([
                        'image_path' => $this->copyMedia($uploads, (string) $rootRelative, 'categories', $rootAttachmentId),
                    ]);
                }
                $rootCategoryIds[$rootId] = $category->id;
            }

            if ($termId === $rootId) {
                $map[$termId] = ['category_id' => $rootCategoryIds[$rootId], 'sub_category_id' => null];
                continue;
            }

            $slug = Str::slug((string) $row->slug) ?: 'category-'.$termId;
            if (SubCategory::where('slug', $slug)->where('wordpress_id', '!=', $termId)->exists()) {
                $slug .= '-'.$termId;
            }
            $name = html_entity_decode((string) $row->name, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            if (SubCategory::where('category_id', $rootCategoryIds[$rootId])->where('name', $name)->where('wordpress_id', '!=', $termId)->exists()) {
                $name .= ' ('.$row->slug.')';
            }
            $subCategory = SubCategory::updateOrCreate(
                ['wordpress_id' => $termId],
                [
                    'category_id' => $rootCategoryIds[$rootId],
                    'name' => $name,
                    'slug' => $slug,
                    'description' => $this->nullable($row->description),
                    'source_url' => rtrim((string) $this->option('url'), '/').'/product-category/'.$slug.'/',
                    'is_active' => true,
                ]
            );
            $attachmentId = (int) ($termMeta[$termId]['thumbnail_id'] ?? 0);
            $relative = $attachmentMeta[$attachmentId]['_wp_attached_file'] ?? null;
            if ($relative) {
                $subCategory->update(['image_path' => $this->copyMedia($uploads, (string) $relative, 'sub-categories', $attachmentId)]);
            }
            $map[$termId] = ['category_id' => $rootCategoryIds[$rootId], 'sub_category_id' => $subCategory->id];
        }

        foreach ($rootCategoryIds as $rootId => $categoryId) {
            $category = Category::find($categoryId);
            if (! $category || $category->image_path) {
                continue;
            }
            foreach ($rows as $candidate) {
                $candidateId = (int) $candidate->term_id;
                if (($map[$candidateId]['category_id'] ?? null) !== $categoryId) {
                    continue;
                }
                $attachmentId = (int) ($termMeta[$candidateId]['thumbnail_id'] ?? 0);
                $relative = $attachmentMeta[$attachmentId]['_wp_attached_file'] ?? null;
                if ($relative) {
                    $category->update([
                        'image_path' => $this->copyMedia($uploads, (string) $relative, 'categories', $attachmentId),
                    ]);
                    break;
                }
            }
            if (! $category->fresh()->image_path) {
                $productImage = Product::where('category_id', $categoryId)
                    ->whereNotNull('image_path')
                    ->where('image_path', '!=', '')
                    ->value('image_path');
                if ($productImage) {
                    $category->update(['image_path' => $productImage]);
                }
            }
            if (! $category->fresh()->image_path) {
                $sourceImage = DB::connection('wordpress')->table('wp_term_taxonomy as tt')
                    ->join('wp_term_relationships as tr', 'tr.term_taxonomy_id', '=', 'tt.term_taxonomy_id')
                    ->join('wp_posts as p', function ($join) {
                        $join->on('p.ID', '=', 'tr.object_id')->where('p.post_type', 'product');
                    })
                    ->join('wp_postmeta as thumb', function ($join) {
                        $join->on('thumb.post_id', '=', 'p.ID')->where('thumb.meta_key', '_thumbnail_id');
                    })
                    ->join('wp_postmeta as attached', function ($join) {
                        $join->on('attached.post_id', '=', DB::raw('CAST(thumb.meta_value AS UNSIGNED)'))
                            ->where('attached.meta_key', '_wp_attached_file');
                    })
                    ->where('tt.taxonomy', 'product_cat')
                    ->where('tt.term_id', $rootId)
                    ->where('attached.meta_value', '!=', '')
                    ->value('attached.meta_value');
                if ($sourceImage) {
                    $category->update([
                        'image_path' => $this->copyMedia($uploads, (string) $sourceImage, 'categories', $rootId),
                    ]);
                }
            }
        }
        return $map;
    }

    private function productCategoryTerms(array $productIds): array
    {
        $rows = DB::connection('wordpress')->table('wp_term_relationships as tr')
            ->join('wp_term_taxonomy as tt', 'tt.term_taxonomy_id', '=', 'tr.term_taxonomy_id')
            ->where('tt.taxonomy', 'product_cat')->whereIn('tr.object_id', $productIds)
            ->select('tr.object_id', 'tt.term_id')->get();
        $result = [];
        foreach ($rows as $row) {
            $result[(int) $row->object_id][] = (int) $row->term_id;
        }
        return $result;
    }

    private function productColorTerms(array $productIds): array
    {
        $rows = DB::connection('wordpress')->table('wp_term_relationships as tr')
            ->join('wp_term_taxonomy as tt', 'tt.term_taxonomy_id', '=', 'tr.term_taxonomy_id')
            ->join('wp_terms as t', 't.term_id', '=', 'tt.term_id')
            ->leftJoin('wp_termmeta as image_meta', function ($join) {
                $join->on('image_meta.term_id', '=', 't.term_id')->where('image_meta.meta_key', 'image');
            })
            ->whereIn('tr.object_id', $productIds)
            ->where(function ($query) {
                $query->where('tt.taxonomy', 'like', '%color%')->orWhere('tt.taxonomy', 'like', '%colour%');
            })
            ->select('tr.object_id', 't.term_id', 't.name', 't.slug', 'tt.taxonomy', 'image_meta.meta_value as image')
            ->get();
        $result = [];
        foreach ($rows as $row) {
            $result[(int) $row->object_id][] = $row;
        }
        return $result;
    }

    private function syncColors(Product $product, array $terms, string $uploads): void
    {
        $ids = [];
        foreach ($terms as $term) {
            $name = html_entity_decode((string) $term->name, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            $color = Color::firstOrCreate(['name' => $name], ['is_active' => true]);
            if (! $color->image_path && is_string($term->image) && str_contains($term->image, '/wp-content/uploads/')) {
                $relative = urldecode(Str::after($term->image, '/wp-content/uploads/'));
                $color->update(['image_path' => $this->copyMedia($uploads, $relative, 'colors', (int) $term->term_id)]);
            }
            $ids[] = $color->id;
        }
        $product->colors()->sync(array_values(array_unique($ids)));
    }

    private function syncPhysicalMeasurements(Product $product, array $meta): void
    {
        $data = [
            'physical_length' => $this->measurementNumber($meta['_length'] ?? null),
            'physical_width' => $this->measurementNumber($meta['_width'] ?? null),
            'physical_height' => $this->measurementNumber($meta['_height'] ?? null),
            'dimension_unit' => 'cm',
        ];

        $weight = $this->measurementNumber($meta['_weight'] ?? null);
        if ($weight !== null && $weight <= 500) {
            $data['physical_weight'] = $weight;
            $data['weight_unit'] = 'kg';
        }

        $product->update($data);

        $standardMeasurementIds = Measurement::query()
            ->get(['id', 'name'])
            ->filter(fn (Measurement $measurement) => in_array(
                Str::lower(trim($measurement->name)),
                ['length', 'width', 'height', 'weight'],
                true
            ))
            ->pluck('id');

        if ($standardMeasurementIds->isNotEmpty()) {
            $product->measurements()->detach($standardMeasurementIds);
        }
    }

    private function importBanners(string $uploads): int
    {
        if (! DB::connection('wordpress')->getSchemaBuilder()->hasTable('wp_revslider_slides')) {
            return 0;
        }

        $sliderId = DB::connection('wordpress')->table('wp_revslider_sliders')
            ->where('alias', 'slider-1')->value('id');
        if (! $sliderId) {
            return 0;
        }

        $count = 0;
        $slides = DB::connection('wordpress')->table('wp_revslider_slides')
            ->where('slider_id', $sliderId)->orderBy('slide_order')->get();
        foreach ($slides as $slide) {
            $params = json_decode((string) $slide->params, true) ?: [];
            $layers = json_decode((string) $slide->layers, true) ?: [];
            $imageUrl = data_get($params, 'bg.image');
            if (! is_string($imageUrl) || ! str_contains($imageUrl, '/wp-content/uploads/')) {
                continue;
            }
            $relative = urldecode(Str::after($imageUrl, '/wp-content/uploads/'));
            $stored = $this->copyMedia($uploads, $relative, 'banners', (int) $slide->id);
            if ($stored === null) {
                continue;
            }

            $buttonText = null;
            $buttonLink = null;
            foreach ($layers as $layer) {
                if (! is_array($layer)) {
                    continue;
                }
                $text = trim(strip_tags((string) ($layer['text'] ?? '')));
                if ($buttonText === null && $text !== '' && preg_match('/shop|view|collection|discover|learn/i', $text)) {
                    $buttonText = $text;
                    $buttonLink = $this->findLayerUrl($layer);
                }
            }

            Banner::updateOrCreate(
                ['wordpress_id' => (int) $slide->id],
                [
                    'title' => (string) ($params['title'] ?? 'Banner '.$slide->id),
                    'button_text' => $buttonText,
                    'button_link' => $buttonLink,
                    'source_url' => $imageUrl,
                    'image_path' => $stored,
                    'is_active' => true,
                    'sort_order' => (int) $slide->slide_order,
                ]
            );
            $count++;
        }
        return $count;
    }

    private function findLayerUrl(array $data): ?string
    {
        foreach ($data as $key => $value) {
            if (is_string($value) && preg_match('/^(https?:\/\/|\/)/', $value) && preg_match('/url|link|href/i', (string) $key)) {
                return $value;
            }
            if (is_array($value) && ($found = $this->findLayerUrl($value))) {
                return $found;
            }
        }
        return null;
    }

    private function metaFor(string $table, string $idColumn, array $ids): array
    {
        if ($ids === []) {
            return [];
        }
        $result = [];
        DB::connection('wordpress')->table($table)->whereIn($idColumn, $ids)
            ->select($idColumn, 'meta_key', 'meta_value')->orderBy('meta_id')
            ->get()->each(function ($row) use (&$result, $idColumn) {
                $result[(int) $row->{$idColumn}][(string) $row->meta_key] = $row->meta_value;
            });
        return $result;
    }

    private function copyMedia(string $uploads, string $relative, string $folder, int $sourceId): ?string
    {
        $relative = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, ltrim($relative, '/\\'));
        $source = $uploads.DIRECTORY_SEPARATOR.$relative;
        if (! is_file($source)) {
            return null;
        }
        $name = $sourceId.'-'.Str::slug(pathinfo($source, PATHINFO_FILENAME)).'.'.strtolower(pathinfo($source, PATHINFO_EXTENSION));
        $targetRelative = $folder.'/'.$name;
        $target = storage_path('app/public/'.str_replace('/', DIRECTORY_SEPARATOR, $targetRelative));
        File::ensureDirectoryExists(dirname($target));
        if (! is_file($target) || filesize($target) !== filesize($source)) {
            File::copy($source, $target);
        }
        return $targetRelative;
    }

    private function uniqueSlug(string $source, int $wordpressId): string
    {
        $slug = Str::slug($source) ?: 'product-'.$wordpressId;
        $conflict = Product::where('slug', $slug)->where('wordpress_id', '!=', $wordpressId)->exists();
        return $conflict ? $slug.'-'.$wordpressId : $slug;
    }

    private function money(mixed $value): ?float
    {
        if ($value === null || $value === '' || ! is_numeric($value)) {
            return null;
        }
        return round((float) $value, 2);
    }

    private function nullable(mixed $value): ?string
    {
        $value = trim((string) $value);
        return $value === '' ? null : $value;
    }

    private function measurementNumber(mixed $value): ?float
    {
        return is_numeric($value) && (float) $value >= 0 ? (float) $value : null;
    }
}
