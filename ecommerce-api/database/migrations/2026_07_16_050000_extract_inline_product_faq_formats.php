<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $products = DB::table('products')->whereNotNull('short_description')->get(['id', 'short_description']);
        foreach ($products as $product) {
            $text = (string) $product->short_description;
            if (! preg_match('/(?:common|frequently|customer).*(?:question|answer)/iu', $text, $header, PREG_OFFSET_CAPTURE)) continue;
            $offset = $header[0][1];
            $faqText = mb_substr($text, $offset);
            preg_match_all('/(?:✅|❓)\s*([^?]+\?)\s*(.*?)(?=(?:✅|❓)|$)/us', $faqText, $matches, PREG_SET_ORDER);
            if ($matches === [] && preg_match('/:\s*([^?]+\?)\s*(.+?)(?=\n[^\n]*(?:Tap|Add to Cart)|$)/us', $faqText, $single)) {
                $matches = [[$single[0], $single[1], $single[2]]];
            }
            if ($matches === []) continue;

            $sort = (int) (DB::table('product_faqs')->where('product_id', $product->id)->max('sort_order') ?? -1) + 1;
            foreach ($matches as $match) {
                $question = trim($match[1]);
                $answer = trim(preg_replace('/^[\s—–:-]+|[\s—–]+$/u', '', $match[2]));
                if ($question === '' || $answer === '') continue;
                DB::table('product_faqs')->insert([
                    'product_id' => $product->id, 'question' => $question, 'answer' => $answer,
                    'sort_order' => $sort++, 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            DB::table('products')->where('id', $product->id)->update([
                'short_description' => trim(mb_substr($text, 0, $offset)) ?: null,
            ]);
        }
    }

    public function down(): void {}
};
