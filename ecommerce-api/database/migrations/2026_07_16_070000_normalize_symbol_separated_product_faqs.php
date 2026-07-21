<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach ([330, 546, 556] as $productId) {
            $product = DB::table('products')->where('id', $productId)->first(['short_description']);
            $existing = DB::table('product_faqs')->where('product_id', $productId)->orderBy('sort_order')->get();
            $source = $existing->map(fn ($faq) => $faq->question.' '.$faq->answer)->implode("\n");

            if ($productId === 546 && $product && preg_match('/(?:common|frequently|customer).*(?:question|answer)/iu', $product->short_description, $header, PREG_OFFSET_CAPTURE)) {
                $offset = $header[0][1];
                $source = mb_substr($product->short_description, $offset);
                DB::table('products')->where('id', $productId)->update(['short_description' => trim(mb_substr($product->short_description, 0, $offset)) ?: null]);
            }

            $source = preg_replace('/^.*?(?:questions?|answers?)\s*[:!]*/iu', '', $source);
            $source = preg_replace('/[\p{So}\x{FE0F}]+/u', "\n", $source);
            $parts = preg_split('/\n+/u', $source) ?: [];
            $pairs = [];
            foreach ($parts as $part) {
                $part = trim($part);
                $end = mb_strpos($part, '?');
                if ($end === false) continue;
                $question = trim(preg_replace('/^[^\p{L}\p{N}]+/u', '', mb_substr($part, 0, $end + 1)));
                $answer = trim(preg_replace('/^[\s—–:-]+/u', '', mb_substr($part, $end + 1)));
                $answer = trim(preg_replace('/\s*(?:Tap|Add to Cart).*$/ius', '', $answer));
                if ($question !== '' && $answer !== '') $pairs[] = compact('question', 'answer');
            }
            if ($pairs === []) continue;
            DB::table('product_faqs')->where('product_id', $productId)->delete();
            foreach ($pairs as $index => $pair) {
                DB::table('product_faqs')->insert($pair + ['product_id' => $productId, 'sort_order' => $index, 'created_at' => now(), 'updated_at' => now()]);
            }
        }
    }

    public function down(): void {}
};
