<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $repairs = [
            330 => [
                ['Will it work in the UAE?', 'Absolutely — designed for GCC conditions.'],
                ['How long does it last?', 'Up to 6 hours per charge.'],
                ['Is it water-resistant?', 'Yes, ideal for outdoor spaces.'],
            ],
            546 => [
                ['Will it survive UAE heat?', 'Absolutely — built for harsh sun and salty air!'],
            ],
            556 => [
                ['Will it last in the UAE climate?', 'Absolutely! Its weatherproof design is ideal for sun, humidity, and sand.'],
                ['Is it easy to clean?', 'Very! Just wipe down the surface with a cloth.'],
                ['Will it fit in smaller spaces?', 'Yes! Its compact design suits patios, terraces, or garden spaces.'],
            ],
        ];

        foreach ($repairs as $productId => $pairs) {
            if (! DB::table('products')->where('id', $productId)->exists()) {
                continue;
            }
            DB::table('product_faqs')->where('product_id', $productId)->delete();
            foreach ($pairs as $index => [$question, $answer]) {
                DB::table('product_faqs')->insert([
                    'product_id' => $productId, 'question' => $question, 'answer' => $answer,
                    'sort_order' => $index, 'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            $description = DB::table('products')->where('id', $productId)->value('short_description');
            if ($description && preg_match('/(?:common|frequently|customer).*(?:question|answer)/iu', $description, $match, PREG_OFFSET_CAPTURE)) {
                DB::table('products')->where('id', $productId)->update([
                    'short_description' => trim(mb_substr($description, 0, $match[0][1])) ?: null,
                ]);
            }
        }
    }

    public function down(): void {}
};
