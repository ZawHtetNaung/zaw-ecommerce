<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\SizeOption;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MapWordPressSizes extends Command
{
    protected $signature = 'wordpress:map-sizes {--database=i8055463_wp1}';
    protected $description = 'Map WordPress pa_size terms to Laravel product size options';

    public function handle(): int
    {
        $base = config('database.connections.mysql');
        $base['database'] = $this->option('database');
        config(['database.connections.wordpress_sizes' => $base]);
        DB::purge('wordpress_sizes');
        $rows = DB::connection('wordpress_sizes')->table('wp_term_relationships as tr')
            ->join('wp_term_taxonomy as tt', 'tt.term_taxonomy_id', '=', 'tr.term_taxonomy_id')
            ->join('wp_terms as t', 't.term_id', '=', 'tt.term_id')
            ->where('tt.taxonomy', 'pa_size')
            ->orderBy('tr.object_id')->orderBy('t.term_id')
            ->get(['tr.object_id', 't.name', 't.slug']);

        $mapped = 0;
        foreach ($rows->groupBy('object_id') as $wordpressId => $terms) {
            $product = Product::where('wordpress_id', $wordpressId)->first();
            if (! $product) continue;
            $sync = [];
            foreach ($terms as $index => $term) {
                $slug = Str::slug($term->slug ?: $term->name);
                $option = SizeOption::firstOrCreate(['slug' => $slug], ['name' => trim($term->name)]);
                $sync[$option->id] = ['sort_order' => $index];
            }
            $product->sizeOptions()->sync($sync);
            $mapped++;
        }
        $this->info("Mapped size options to {$mapped} products.");
        return self::SUCCESS;
    }
}
