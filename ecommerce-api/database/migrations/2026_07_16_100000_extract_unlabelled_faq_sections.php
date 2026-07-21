<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('products')->whereNotNull('short_description')->select(['id', 'short_description'])->orderBy('id')
            ->chunkById(100, function ($products): void {
                foreach ($products as $product) {
                    $text = str_replace(['\\r\\n', '\\n', "\r\n", "\r"], "\n", (string) $product->short_description);
                    $lines = preg_split('/\n/u', $text) ?: [];
                    $header = null;
                    foreach ($lines as $index => $line) {
                        if (preg_match('/^\s*FAQs?\s*:?[\s.!-]*$/iu', trim($line))) {
                            $header = $index;
                            break;
                        }
                    }
                    if ($header === null) continue;

                    $faqs = [];
                    $cursor = $header + 1;
                    $end = $cursor;
                    while ($cursor < count($lines)) {
                        while ($cursor < count($lines) && trim($lines[$cursor]) === '') $cursor++;
                        if ($cursor >= count($lines) || ! str_ends_with(trim($lines[$cursor]), '?')) break;
                        $question = trim($lines[$cursor++]);
                        while ($cursor < count($lines) && trim($lines[$cursor]) === '') $cursor++;
                        if ($cursor >= count($lines)) break;
                        $answer = trim($lines[$cursor++]);
                        if ($answer === '' || str_ends_with($answer, '?')) break;
                        $faqs[] = compact('question', 'answer');
                        $end = $cursor;
                    }
                    if ($faqs === []) continue;

                    $remaining = array_merge(array_slice($lines, 0, $header), array_slice($lines, $end));
                    while ($remaining && trim($remaining[0]) === '') array_shift($remaining);
                    while ($remaining && trim(end($remaining)) === '') array_pop($remaining);
                    DB::table('products')->where('id', $product->id)->update([
                        'short_description' => trim(implode("\n", $remaining)) ?: null,
                    ]);

                    $sort = (int) (DB::table('product_faqs')->where('product_id', $product->id)->max('sort_order') ?? -1) + 1;
                    foreach ($faqs as $faq) {
                        $exists = DB::table('product_faqs')->where('product_id', $product->id)->where('question', $faq['question'])->exists();
                        if ($exists) continue;
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
