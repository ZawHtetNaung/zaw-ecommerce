<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach ([330, 546, 556] as $productId) {
            $product = DB::table('products')->where('id', $productId)->first(['short_description']);
            if (! $product) continue;
            $text = (string) $product->short_description;

            if ($productId === 330) {
                $old = DB::table('product_faqs')->where('product_id', $productId)->first();
                $faqText = $old ? $old->question.' '.$old->answer : '';
            } else {
                if (! preg_match('/(?:common|frequently|customer).*(?:question|answer)/iu', $text, $header, PREG_OFFSET_CAPTURE)) continue;
                $offset = $header[0][1];
                $faqText = mb_substr($text, $offset);
                DB::table('products')->where('id', $productId)->update(['short_description' => trim(mb_substr($text, 0, $offset)) ?: null]);
            }

            $faqText = preg_replace('/^.*?(?:questions?|answers?)\s*[:!]*/iu', '', $faqText);
            $faqText = str_replace(['✅', '❓'], "\n", $faqText);
            DB::table('product_faqs')->where('product_id', $productId)->delete();
            $sort = 0;
            foreach (preg_split('/\n/u', $faqText) ?: [] as $part) {
                $part = trim($part);
                $end = mb_strpos($part, '?');
                if ($end === false) continue;
                $question = trim(mb_substr($part, 0, $end + 1));
                $answer = trim(preg_replace('/^[\s—–:-]+/u', '', mb_substr($part, $end + 1)));
                $answer = preg_replace('/\s*(?:💳|👉).*$/us', '', $answer);
                if ($question === '' || $answer === '') continue;
                DB::table('product_faqs')->insert([
                    'product_id' => $productId, 'question' => $question, 'answer' => trim($answer),
                    'sort_order' => $sort++, 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void {}
};
