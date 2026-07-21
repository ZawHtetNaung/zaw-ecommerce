<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $products = DB::table('products')->where('short_description', 'like', '%?%')->get(['id', 'short_description']);
        foreach ($products as $product) {
            $text = str_replace(['\\r\\n', '\\n', "\r\n", "\r"], "\n", (string) $product->short_description);
            $lines = preg_split('/\n/u', $text) ?: [];
            $remove = [];
            $faqs = [];

            foreach ($lines as $index => $line) {
                preg_match_all('/(?:^|\s)\d+\.\s*([^?]+\?)\s*(.*?)(?=(?:\s+\d+\.)|$)/u', trim($line), $matches, PREG_SET_ORDER);
                if (count($matches) < 2) continue;
                foreach ($matches as $match) {
                    if (trim($match[2]) !== '') $faqs[] = ['question' => trim($match[1]), 'answer' => trim($match[2])];
                }
                $remove[$index] = true;
            }

            for ($index = 0; $index < count($lines); $index++) {
                if (isset($remove[$index]) || ! str_ends_with(trim($lines[$index]), '?')) continue;
                $group = [];
                $indices = [];
                $cursor = $index;
                while ($cursor < count($lines)) {
                    while ($cursor < count($lines) && trim($lines[$cursor]) === '') $cursor++;
                    if ($cursor >= count($lines) || ! str_ends_with(trim($lines[$cursor]), '?')) break;
                    $questionIndex = $cursor;
                    $question = preg_replace('/^\s*(?:Q\s*)?\d*\s*[.):\-]?\s*/iu', '', trim($lines[$cursor++]));
                    while ($cursor < count($lines) && trim($lines[$cursor]) === '') $cursor++;
                    if ($cursor >= count($lines) || str_ends_with(trim($lines[$cursor]), '?')) break;
                    $answerIndex = $cursor;
                    $answer = trim($lines[$cursor++]);
                    $group[] = compact('question', 'answer');
                    $indices[] = [$questionIndex, $answerIndex];
                }
                if (count($group) < 2) continue;
                array_push($faqs, ...$group);
                foreach ($indices as [$from, $to]) {
                    for ($lineIndex = $from; $lineIndex <= $to; $lineIndex++) $remove[$lineIndex] = true;
                }
                $index = $cursor - 1;
            }

            if ($faqs === []) continue;
            $remaining = array_values(array_filter($lines, fn ($line, $index) => ! isset($remove[$index]), ARRAY_FILTER_USE_BOTH));
            DB::table('products')->where('id', $product->id)->update(['short_description' => trim(implode("\n", $remaining)) ?: null]);
            $sort = (int) (DB::table('product_faqs')->where('product_id', $product->id)->max('sort_order') ?? -1) + 1;
            foreach ($faqs as $faq) {
                if (DB::table('product_faqs')->where('product_id', $product->id)->where('question', $faq['question'])->exists()) continue;
                DB::table('product_faqs')->insert($faq + ['product_id' => $product->id, 'sort_order' => $sort++, 'created_at' => now(), 'updated_at' => now()]);
            }
        }
    }

    public function down(): void {}
};
