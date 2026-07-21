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
                    $lines = preg_split('/\n/u', (string) $product->short_description) ?: [];
                    $headerIndex = null;
                    foreach ($lines as $index => $line) {
                        if (preg_match('/(?:common|frequently|customer).*(?:question|answer)|questions?\s*(?:&|and)\s*answers?/iu', $line)) {
                            $headerIndex = $index;
                            break;
                        }
                    }
                    if ($headerIndex === null) continue;

                    $hasFaqs = DB::table('product_faqs')->where('product_id', $product->id)->exists();
                    $faqs = $hasFaqs ? [] : $this->pairs(array_slice($lines, $headerIndex + 1));
                    if (! $hasFaqs && $faqs === []) continue;

                    DB::table('products')->where('id', $product->id)->update([
                        'short_description' => trim(implode("\n", array_slice($lines, 0, $headerIndex))) ?: null,
                    ]);
                    foreach ($faqs as $index => $faq) {
                        DB::table('product_faqs')->insert([
                            'product_id' => $product->id,
                            'question' => $faq['question'],
                            'answer' => $faq['answer'],
                            'sort_order' => $index,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }
            });
    }

    private function pairs(array $lines): array
    {
        $pairs = [];
        $current = null;
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '') continue;
            $candidate = preg_replace('/^(?:Q(?:uestion)?\s*)?\d*\s*[:.)-]?\s*/iu', '', $line);
            if (str_contains($candidate, '?')) {
                if ($current && $current['answer'] !== '') $pairs[] = $current;
                $end = mb_strpos($candidate, '?');
                $current = [
                    'question' => trim(mb_substr($candidate, 0, $end + 1)),
                    'answer' => trim(mb_substr($candidate, $end + 1)),
                ];
            } elseif ($current) {
                $answer = preg_replace('/^(?:A(?:nswer)?\s*\d*\s*[:.)-])\s*/iu', '', $line);
                $answer = preg_replace('/^[\x{2705}\x{FE0F}\s]+/u', '', $answer);
                $current['answer'] = trim($current['answer'].' '.$answer);
            }
        }
        if ($current && $current['answer'] !== '') $pairs[] = $current;
        return $pairs;
    }

    public function down(): void {}
};
