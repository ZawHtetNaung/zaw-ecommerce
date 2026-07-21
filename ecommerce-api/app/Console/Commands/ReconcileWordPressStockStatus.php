<?php

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class ReconcileWordPressStockStatus extends Command
{
    protected $signature = 'wordpress:reconcile-stock
        {--database=i8055463_wp1 : Canonical WordPress database}
        {--apply : Apply the reported stock corrections}';

    protected $description = 'Reconcile explicit product availability with canonical WooCommerce stock status';

    public function handle(): int
    {
        if (! Schema::hasColumn('products', 'is_in_stock')) {
            $this->error('Run the Laravel migrations before reconciling stock status.');

            return self::FAILURE;
        }

        $base = config('database.connections.mysql');
        $base['database'] = (string) $this->option('database');
        config(['database.connections.wordpress_stock' => $base]);
        DB::purge('wordpress_stock');

        try {
            $sourceRows = DB::connection('wordpress_stock')
                ->table('wp_posts as posts')
                ->leftJoin('wp_postmeta as meta', function ($join): void {
                    $join->on('meta.post_id', '=', 'posts.ID')
                        ->whereIn('meta.meta_key', ['_stock', '_stock_status']);
                })
                ->where('posts.post_type', 'product')
                ->whereIn('posts.post_status', ['publish', 'private', 'draft'])
                ->groupBy('posts.ID')
                ->selectRaw("posts.ID,
                    MAX(CASE WHEN meta.meta_key = '_stock' THEN meta.meta_value END) AS stock_quantity,
                    MAX(CASE WHEN meta.meta_key = '_stock_status' THEN meta.meta_value END) AS stock_status")
                ->get()
                ->keyBy(fn (object $row): int => (int) $row->ID);
        } catch (Throwable $exception) {
            $this->error('Cannot read the canonical WordPress database: '.$exception->getMessage());

            return self::FAILURE;
        }

        $apply = (bool) $this->option('apply');
        $changed = 0;
        $unchanged = 0;
        $missing = 0;
        $inStock = 0;
        $outOfStock = 0;

        Product::query()
            ->whereNotNull('wordpress_id')
            ->orderBy('id')
            ->chunkById(100, function ($products) use (
                $sourceRows,
                $apply,
                &$changed,
                &$unchanged,
                &$missing,
                &$inStock,
                &$outOfStock,
            ): void {
                foreach ($products as $product) {
                    $source = $sourceRows->get((int) $product->wordpress_id);
                    if (! $source) {
                        $missing++;
                        continue;
                    }

                    $quantity = max(0, (int) ($source->stock_quantity ?? 0));
                    $status = strtolower(trim((string) ($source->stock_status ?? '')));
                    $isInStock = match ($status) {
                        'instock' => true,
                        'outofstock' => false,
                        default => $quantity > 0,
                    };
                    $quantity = $isInStock ? max(1, $quantity) : 0;

                    $isInStock ? $inStock++ : $outOfStock++;

                    if (
                        (bool) $product->is_in_stock === $isInStock
                        && (int) $product->stock === $quantity
                    ) {
                        $unchanged++;
                        continue;
                    }

                    $changed++;
                    if ($apply) {
                        $product->update([
                            'is_in_stock' => $isInStock,
                            'stock' => $quantity,
                        ]);
                    }
                }
            });

        $this->table(
            ['Mode', 'Would change', 'Already correct', 'Source missing', 'In stock', 'Out of stock'],
            [[
                $apply ? 'APPLY' : 'DRY RUN',
                $changed,
                $unchanged,
                $missing,
                $inStock,
                $outOfStock,
            ]]
        );

        if (! $apply) {
            $this->info('No data was changed. Re-run with --apply after reviewing the counts.');
        }

        return self::SUCCESS;
    }
}
