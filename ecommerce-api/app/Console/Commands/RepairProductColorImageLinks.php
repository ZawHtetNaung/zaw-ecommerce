<?php

namespace App\Console\Commands;

use App\Models\Color;
use App\Models\Product;
use App\Services\ProductColorImageMatcher;
use Illuminate\Console\Command;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Throwable;

class RepairProductColorImageLinks extends Command
{
    protected $signature = 'products:repair-color-image-links
        {--database=i8055463_wp1 : WordPress database used for original variation metadata}
        {--product= : Limit the audit to one current product ID or slug}
        {--include-inactive : Include inactive products}
        {--apply : Save high-confidence matches instead of running a dry audit}';

    protected $description = 'Connect unmapped product color buttons to existing original gallery images';

    public function handle(ProductColorImageMatcher $matcher): int
    {
        $wordpress = $this->wordpressConnection();
        $productIds = DB::table('color_product')
            ->whereNull('product_image_id')
            ->distinct()
            ->pluck('product_id');
        $products = Product::query()
            ->with(['images', 'colors'])
            ->whereIn('id', $productIds)
            ->when(
                ! $this->option('include-inactive'),
                fn ($query) => $query->where('is_active', true)
            )
            ->when($this->option('product'), function ($query, mixed $product): void {
                $query->where(function ($productQuery) use ($product): void {
                    if (is_numeric($product)) {
                        $productQuery->whereKey((int) $product);
                    } else {
                        $productQuery->where('slug', (string) $product);
                    }
                });
            })
            ->orderBy('id')
            ->get();

        $proposals = [];
        $unresolved = 0;
        $examined = 0;
        $termSlugCache = [];
        $variationCache = [];
        $fileHashCache = [];
        $fileHash = function (string $path) use (&$fileHashCache): ?string {
            if (! array_key_exists($path, $fileHashCache)) {
                $disk = Storage::disk('public');
                $fileHashCache[$path] = $path !== '' && $disk->exists($path)
                    ? (hash_file('sha256', $disk->path($path)) ?: null)
                    : null;
            }

            return $fileHashCache[$path];
        };

        foreach ($products as $product) {
            $usedImageIds = $product->colors
                ->pluck('pivot.product_image_id')
                ->filter()
                ->map(fn (mixed $imageId): int => (int) $imageId)
                ->unique();

            foreach ($product->colors->whereNull('pivot.product_image_id') as $color) {
                $examined++;
                $availableImages = $product->images
                    ->reject(fn ($image): bool => $usedImageIds->contains((int) $image->id))
                    ->values();
                $termSlug = $this->termSlug($wordpress, $color, $termSlugCache);
                $variation = $this->variation(
                    $wordpress,
                    $product,
                    $color,
                    $termSlug,
                    $variationCache
                );
                $match = $matcher->match(
                    $availableImages,
                    $variation,
                    (string) $color->name,
                    $termSlug,
                    (string) ($color->image_path ?? ''),
                    $fileHash
                );

                if (! $match && $variation) {
                    $sharedAttachmentMatch = $matcher->match(
                        $product->images,
                        $variation,
                        (string) $color->name,
                        $termSlug
                    );

                    if (
                        $sharedAttachmentMatch
                        && in_array(
                            $sharedAttachmentMatch['reason'],
                            ['variation_gallery_attachment', 'variation_attachment'],
                            true
                        )
                    ) {
                        $match = $sharedAttachmentMatch;
                    }
                }

                if (! $match) {
                    $unresolved++;

                    continue;
                }

                $image = $match['image'];
                $usedImageIds->push((int) $image->id);
                $proposals[] = [
                    'product_id' => (int) $product->id,
                    'product' => (string) $product->name,
                    'color_id' => (int) $color->id,
                    'color' => (string) $color->name,
                    'image_id' => (int) $image->id,
                    'image' => basename((string) $image->path),
                    'reason' => $match['reason'],
                ];
            }
        }

        if ($this->option('apply') && $proposals !== []) {
            DB::transaction(function () use ($proposals): void {
                foreach ($proposals as $proposal) {
                    DB::table('color_product')
                        ->where('product_id', $proposal['product_id'])
                        ->where('color_id', $proposal['color_id'])
                        ->whereNull('product_image_id')
                        ->update(['product_image_id' => $proposal['image_id']]);
                }
            });
        }

        $this->table(
            ['Product', 'Color', 'Existing image', 'Match'],
            collect($proposals)
                ->take(100)
                ->map(fn (array $proposal): array => [
                    "#{$proposal['product_id']} {$proposal['product']}",
                    $proposal['color'],
                    "#{$proposal['image_id']} {$proposal['image']}",
                    $proposal['reason'],
                ])
                ->all()
        );

        if (count($proposals) > 100) {
            $this->line('Showing the first 100 high-confidence matches.');
        }

        $this->newLine();
        $this->info(sprintf(
            '%s %d of %d unmapped color buttons across %d products; %d remain unresolved.',
            $this->option('apply') ? 'Connected' : 'Can connect',
            count($proposals),
            $examined,
            $products->count(),
            $unresolved
        ));
        $this->line('No image files were copied or created.');

        if (! $this->option('apply')) {
            $this->warn('Dry run only. Re-run with --apply to save these mappings.');
        }

        return self::SUCCESS;
    }

    private function wordpressConnection(): ?ConnectionInterface
    {
        try {
            $configuration = config('database.connections.mysql');
            $configuration['database'] = (string) $this->option('database');
            config(['database.connections.wordpress_color_repair' => $configuration]);
            DB::purge('wordpress_color_repair');
            $connection = DB::connection('wordpress_color_repair');
            $connection->getPdo();

            return $connection;
        } catch (Throwable $exception) {
            $this->warn(
                'WordPress variation metadata is unavailable; using unique current filenames only. '
                .$exception->getMessage()
            );

            return null;
        }
    }

    /**
     * @param  array<string, string>  $cache
     */
    private function termSlug(
        ?ConnectionInterface $wordpress,
        Color $color,
        array &$cache
    ): string {
        if (! $wordpress || ! $color->wordpress_term_id || ! $color->source_taxonomy) {
            return '';
        }

        $key = $color->source_taxonomy.':'.$color->wordpress_term_id;
        if (! array_key_exists($key, $cache)) {
            $cache[$key] = (string) ($wordpress->table('wp_terms as terms')
                ->join('wp_term_taxonomy as taxonomy', 'taxonomy.term_id', '=', 'terms.term_id')
                ->where('terms.term_id', $color->wordpress_term_id)
                ->where('taxonomy.taxonomy', $color->source_taxonomy)
                ->value('terms.slug') ?? '');
        }

        return $cache[$key];
    }

    /**
     * @param  array<string, object|null>  $cache
     */
    private function variation(
        ?ConnectionInterface $wordpress,
        Product $product,
        Color $color,
        string $termSlug,
        array &$cache
    ): ?object {
        if (
            ! $wordpress
            || ! $product->wordpress_id
            || ! $color->source_taxonomy
            || $termSlug === ''
        ) {
            return null;
        }

        $key = $product->wordpress_id.':'.$color->source_taxonomy.':'.$termSlug;
        if (! array_key_exists($key, $cache)) {
            $cache[$key] = $wordpress->table('wp_postmeta as attribute')
                ->join('wp_posts as variation', function ($join): void {
                    $join->on('variation.ID', '=', 'attribute.post_id')
                        ->where('variation.post_type', 'product_variation');
                })
                ->leftJoin('wp_postmeta as thumbnail', function ($join): void {
                    $join->on('thumbnail.post_id', '=', 'variation.ID')
                        ->where('thumbnail.meta_key', '_thumbnail_id');
                })
                ->leftJoin('wp_postmeta as file', function ($join): void {
                    $join->on('file.post_id', '=', DB::raw('CAST(thumbnail.meta_value AS UNSIGNED)'))
                        ->where('file.meta_key', '_wp_attached_file');
                })
                ->leftJoin('wp_postmeta as additional', function ($join): void {
                    $join->on('additional.post_id', '=', 'variation.ID')
                        ->where('additional.meta_key', 'wd_additional_variation_images_data');
                })
                ->where('variation.post_parent', $product->wordpress_id)
                ->where('attribute.meta_key', 'attribute_'.$color->source_taxonomy)
                ->where('attribute.meta_value', $termSlug)
                ->selectRaw(
                    'CAST(thumbnail.meta_value AS UNSIGNED) as attachment_id, '
                    .'file.meta_value as relative_path, additional.meta_value as additional_attachment_ids'
                )
                ->first();
        }

        return $cache[$key];
    }
}
