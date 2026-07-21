<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('products')->where('short_description', 'like', '%?%')->select(['id', 'short_description'])->orderBy('id')
            ->chunkById(100, function ($products): void {
                foreach ($products as $product) {
                    $text = str_replace(['\\r\\n', '\\n', "\r\n", "\r"], "\n", (string) $product->short_description);
                    $paragraphs = preg_split('/\n\s*\n/u', $text) ?: [];
                    $candidates = [];
                    foreach ($paragraphs as $index => $paragraph) {
                        $lines = array_values(array_filter(array_map('trim', preg_split('/\n/u', trim($paragraph)) ?: []), fn ($line) => $line !== ''));
                        if (count($lines) < 2) continue;
                        $question = preg_replace('/^\s*(?:Q(?:uestion)?\s*)?\d*\s*[.):\-]?\s*/iu', '', array_shift($lines));
                        if (! str_ends_with($question, '?')) continue;
                        $answer = trim(implode("\n", $lines));
                        if ($answer === '' || str_ends_with($answer, '?')) continue;
                        $candidates[$index] = compact('question', 'answer');
                    }

                    $groups = [];
                    $group = [];
                    $previous = null;
                    foreach ($candidates as $index => $faq) {
                        if ($previous !== null && $index !== $previous + 1) {
                            if (count($group) >= 2) $groups[] = $group;
                            $group = [];
                        }
                        $group[$index] = $faq;
                        $previous = $index;
                    }
                    if (count($group) >= 2) $groups[] = $group;
                    if ($groups === []) continue;

                    $extracted = [];
                    foreach ($groups as $items) $extracted += $items;
                    $remaining = array_values(array_filter($paragraphs, fn ($paragraph, $index) => ! isset($extracted[$index]), ARRAY_FILTER_USE_BOTH));
                    DB::table('products')->where('id', $product->id)->update([
                        'short_description' => trim(implode("\n\n", $remaining)) ?: null,
                    ]);

                    $sort = (int) (DB::table('product_faqs')->where('product_id', $product->id)->max('sort_order') ?? -1) + 1;
                    foreach ($extracted as $faq) {
                        if (DB::table('product_faqs')->where('product_id', $product->id)->where('question', $faq['question'])->exists()) continue;
                        DB::table('product_faqs')->insert($faq + [
                            'product_id' => $product->id, 'sort_order' => $sort++,
                            'created_at' => now(), 'updated_at' => now(),
                        ]);
                    }
                }
            });
    }

    public function down(): void {}
};
