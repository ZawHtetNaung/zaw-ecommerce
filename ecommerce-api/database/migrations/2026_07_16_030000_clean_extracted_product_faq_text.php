<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('products')->whereNotNull('short_description')->select(['id', 'short_description'])->orderBy('id')
            ->chunkById(200, function ($products): void {
                foreach ($products as $product) {
                    $lines = preg_split('/\n/u', (string) $product->short_description) ?: [];
                    $lines = array_values(array_filter($lines, fn ($line) => ! preg_match(
                        '/^\s*[^\pL\pN]*(?:(?:common|frequently|customer).*(?:question|answer)|questions?\s*(?:&|and)\s*answers?)[^\pL\pN]*$/iu',
                        trim($line)
                    )));
                    DB::table('products')->where('id', $product->id)->update([
                        'short_description' => trim(implode("\n", $lines)) ?: null,
                    ]);
                }
            });

        DB::table('product_faqs')->select(['id', 'question', 'answer'])->orderBy('id')->chunkById(300, function ($faqs): void {
            foreach ($faqs as $faq) {
                DB::table('product_faqs')->where('id', $faq->id)->update([
                    'question' => trim(preg_replace('/^[\x{2753}\x{2754}\x{FE0F}\s]+/u', '', $faq->question)),
                    'answer' => trim(preg_replace('/^[\x{2705}\x{FE0F}\s]+/u', '', $faq->answer)),
                ]);
            }
        });
    }

    public function down(): void {}
};
