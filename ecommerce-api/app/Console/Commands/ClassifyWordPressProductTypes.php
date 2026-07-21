<?php

namespace App\Console\Commands;

use App\Models\Category;
use App\Models\Product;
use App\Models\SubCategory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ClassifyWordPressProductTypes extends Command
{
    protected $signature = 'wordpress:classify-product-types
        {--database=i8055463_wp1 : Canonical WordPress database}
        {--apply : Apply the audited classifications}';

    protected $description = 'Classify product behavior and selling units from canonical WordPress evidence';

    private array $parents = [];

    public function handle(): int
    {
        $base = config('database.connections.mysql');
        $base['database'] = $this->option('database');
        config(['database.connections.wordpress_types' => $base]);
        DB::purge('wordpress_types');
        $wp = DB::connection('wordpress_types');

        $taxonomy = $wp->table('wp_term_taxonomy')->where('taxonomy', 'product_cat')->get(['term_id', 'parent']);
        $this->parents = $taxonomy->pluck('parent', 'term_id')->map(fn ($value) => (int) $value)->all();

        $categoryTerms = $wp->table('wp_term_relationships as tr')
            ->join('wp_term_taxonomy as tt', 'tt.term_taxonomy_id', '=', 'tr.term_taxonomy_id')
            ->where('tt.taxonomy', 'product_cat')
            ->get(['tr.object_id', 'tt.term_id'])
            ->groupBy('object_id');
        $attributeTaxonomies = $wp->table('wp_term_relationships as tr')
            ->join('wp_term_taxonomy as tt', 'tt.term_taxonomy_id', '=', 'tr.term_taxonomy_id')
            ->where('tt.taxonomy', 'like', 'pa_%')
            ->get(['tr.object_id', 'tt.taxonomy'])
            ->groupBy('object_id');
        $meta = $wp->table('wp_postmeta')
            ->whereIn('meta_key', [
                '_simple_is_custom_pricing_label', '_simple_is_custom_pricing_label_text',
                '_wvpc_pricing_product', '_wvpca_pricing_product', 'wvpc_measurement',
            ])
            ->get(['post_id', 'meta_key', 'meta_value'])
            ->groupBy('post_id')
            ->map(fn ($rows) => $rows->pluck('meta_value', 'meta_key'));

        $categoryIds = Category::whereNotNull('wordpress_id')->pluck('id', 'wordpress_id');
        $subcategoryIds = SubCategory::whereNotNull('wordpress_id')->pluck('id', 'wordpress_id');
        $floorTaxonomies = [
            'pa_vinyl-flooring-colors', 'pa_carpet-tiles-color', 'pa_roll-color',
            'pa_mosque-carpet-color', 'pa_border-color', 'pa_outdoor-carpet-color',
            'pa_sisal', 'pa_carpet-planks-color',
        ];

        $rows = [];
        $counts = [];
        $unresolved = [];
        $changes = 0;
        foreach (Product::query()->orderBy('id')->get() as $product) {
            $wordpressId = (int) $product->wordpress_id;
            $terms = collect($categoryTerms[$wordpressId] ?? [])->pluck('term_id')->map(fn ($id) => (int) $id)->all();
            $attributes = collect($attributeTaxonomies[$wordpressId] ?? [])->pluck('taxonomy')->unique()->all();
            $productMeta = $meta[$wordpressId] ?? collect();

            $type = $this->typeFor($product->name, $terms, $attributes, $floorTaxonomies, $productMeta);
            $sellingMethod = $this->sellingMethodFor($type, $productMeta);
            if ($sellingMethod === 'unspecified') {
                $unresolved[] = [$wordpressId, $product->name, $type];
            }

            [$categoryId, $subcategoryId] = $this->primaryCategory($type, $terms, $categoryIds->all(), $subcategoryIds->all());
            $data = [
                'product_type' => $type,
                'selling_method' => $sellingMethod,
            ];
            if ($categoryId) {
                $data['category_id'] = $categoryId;
                $data['sub_category_id'] = $subcategoryId;
            }

            $counts[$type][$sellingMethod] = ($counts[$type][$sellingMethod] ?? 0) + 1;
            if ($product->product_type !== $type || $product->selling_method !== $sellingMethod
                || (isset($data['category_id']) && ((int) $product->category_id !== $categoryId || (int) $product->sub_category_id !== (int) $subcategoryId))) {
                $changes++;
            }
            $rows[] = [$product, $data];
        }

        foreach ($counts as $type => $methods) {
            foreach ($methods as $method => $count) {
                $this->line("{$type} / {$method}: {$count}");
            }
        }
        $this->info("Rows requiring a change: {$changes}; unresolved selling units: ".count($unresolved).'.');
        if ($unresolved !== []) {
            $this->table(['WordPress ID', 'Product', 'Type'], array_slice($unresolved, 0, 30));
        }

        if (! $this->option('apply')) {
            $this->warn('Dry run only. Pass --apply to save these classifications.');
            return self::SUCCESS;
        }

        DB::transaction(function () use ($rows): void {
            foreach ($rows as [$product, $data]) {
                $product->update($data);
            }
        });
        $this->info('Canonical product classifications and primary categories applied.');
        return self::SUCCESS;
    }

    private function typeFor(string $name, array $terms, array $attributes, array $floorTaxonomies, $meta): string
    {
        $enabledLabel = strtolower((string) ($meta['_simple_is_custom_pricing_label'] ?? '')) === 'on'
            ? (string) ($meta['_simple_is_custom_pricing_label_text'] ?? '') : '';
        $wallpaper = $this->hasRoot($terms, 41) || in_array(163, $terms, true)
            || in_array('pa_wallpaper-color', $attributes, true)
            || preg_match('/\b(?:wallpaper|wallcovering|wall\s*border)\b/i', $name)
            || (preg_match('/\bborder\b/i', $name) && preg_match('/\broll\b/i', $enabledLabel));
        if ($wallpaper) {
            return 'wallpaper';
        }

        $functionalFlooringTerm = collect($terms)->contains(fn (int $term): bool => $this->hasAncestor($term, 44) && ! $this->hasAncestor($term, 154));
        $flooring = $functionalFlooringTerm || in_array(944, $terms, true)
            || array_intersect($attributes, $floorTaxonomies) !== [];
        return $flooring ? 'flooring' : 'furniture';
    }

    private function sellingMethodFor(string $type, $meta): string
    {
        if ($type === 'furniture') {
            return 'per_item';
        }

        $labelEnabled = strtolower((string) ($meta['_simple_is_custom_pricing_label'] ?? '')) === 'on';
        $label = $labelEnabled ? html_entity_decode((string) ($meta['_simple_is_custom_pricing_label_text'] ?? ''), ENT_QUOTES | ENT_HTML5, 'UTF-8') : '';
        if ($label !== '') {
            if (preg_match('/\broll\b/i', $label)) return 'per_roll';
            if (preg_match('/\bbox\b/i', $label)) return 'per_box';
            if (preg_match('/\bpiece\b/i', $label)) return 'per_item';
            if (preg_match('/(?:m²|m2|sqm|sq\.?\s*m|square\s*met)/iu', $label)) return 'per_square_meter';
            if (preg_match('/(?:\blm\b|linear\s*met|\/\s*m\b)/iu', $label)) return 'per_linear_meter';
        }

        if ($type === 'wallpaper') {
            return 'per_roll';
        }

        $calculatorEnabled = strtolower((string) ($meta['_wvpc_pricing_product'] ?? '')) === 'yes'
            || strtolower((string) ($meta['_wvpca_pricing_product'] ?? '')) === 'yes';
        if ($calculatorEnabled) {
            return match (strtolower((string) ($meta['wvpc_measurement'] ?? ''))) {
                'area' => 'per_square_meter',
                'length' => 'per_linear_meter',
                default => 'unspecified',
            };
        }
        return 'unspecified';
    }

    private function primaryCategory(string $type, array $terms, array $categoryIds, array $subcategoryIds): array
    {
        if ($type === 'wallpaper') {
            $root = 41;
        } elseif ($type === 'flooring') {
            $root = 44;
        } else {
            $root = collect([778, 779, 943, 1005, 1236, 1547, 1548, 955, 15])
                ->first(fn (int $candidate): bool => $this->hasRoot($terms, $candidate));
        }
        if (! $root || ! isset($categoryIds[$root])) {
            return [null, null];
        }

        $leaf = collect($terms)
            ->filter(fn (int $term): bool => $term !== $root && $this->hasAncestor($term, $root) && isset($subcategoryIds[$term]))
            ->sortByDesc(fn (int $term): int => $this->depth($term))
            ->first();
        return [(int) $categoryIds[$root], $leaf ? (int) $subcategoryIds[$leaf] : null];
    }

    private function hasRoot(array $terms, int $root): bool
    {
        return collect($terms)->contains(fn (int $term): bool => $this->hasAncestor($term, $root));
    }

    private function hasAncestor(int $term, int $ancestor): bool
    {
        $seen = [];
        while ($term > 0 && ! isset($seen[$term])) {
            if ($term === $ancestor) return true;
            $seen[$term] = true;
            $term = (int) ($this->parents[$term] ?? 0);
        }
        return false;
    }

    private function depth(int $term): int
    {
        $depth = 0;
        $seen = [];
        while (($this->parents[$term] ?? 0) > 0 && ! isset($seen[$term])) {
            $seen[$term] = true;
            $term = (int) $this->parents[$term];
            $depth++;
        }
        return $depth;
    }
}
