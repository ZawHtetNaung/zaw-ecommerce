<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach ([546, 556] as $productId) {
            $description = (string) DB::table('products')->where('id', $productId)->value('short_description');
            $offset = stripos($description, 'Common Question');
            if ($offset !== false) {
                DB::table('products')->where('id', $productId)->update([
                    'short_description' => trim(substr($description, 0, $offset)) ?: null,
                ]);
            }
        }
        DB::table('product_faqs')->whereIn('product_id', [330, 546])->where('answer', 'like', 'Absolutely ?%')
            ->update(['answer' => DB::raw("REPLACE(answer, 'Absolutely ?', 'Absolutely -')")]);
    }

    public function down(): void {}
};
