<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach (DB::table('products')->where('short_description', 'like', '%?%')->get(['id', 'short_description']) as $product) {
            $text = str_replace(['\\r\\n', '\\n', "\r\n", "\r"], "\n", (string) $product->short_description);
            $lines = preg_split('/\n/u', $text) ?: [];
            $matches = [];
            foreach ($lines as $index => $line) {
                if (preg_match('/^\s*\d+\.\s*([^?]+\?)\s*(.+)$/u', trim($line), $match)) {
                    $matches[$index] = ['question' => trim($match[1]), 'answer' => trim($match[2])];
                }
            }
            if (count($matches) < 2) continue;
            $remaining = array_values(array_filter($lines, fn ($line, $index) => ! isset($matches[$index]), ARRAY_FILTER_USE_BOTH));
            DB::table('products')->where('id', $product->id)->update(['short_description' => trim(implode("\n", $remaining)) ?: null]);
            $sort = (int) (DB::table('product_faqs')->where('product_id', $product->id)->max('sort_order') ?? -1) + 1;
            foreach ($matches as $faq) {
                if (DB::table('product_faqs')->where('product_id', $product->id)->where('question', $faq['question'])->exists()) continue;
                DB::table('product_faqs')->insert($faq + ['product_id' => $product->id, 'sort_order' => $sort++, 'created_at' => now(), 'updated_at' => now()]);
            }
        }
    }

    public function down(): void {}
};
