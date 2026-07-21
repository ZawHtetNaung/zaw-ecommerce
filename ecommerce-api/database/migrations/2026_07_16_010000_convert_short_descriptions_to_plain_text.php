<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('products')
            ->whereNotNull('short_description')
            ->select(['id', 'short_description'])
            ->orderBy('id')
            ->chunkById(200, function ($products): void {
                foreach ($products as $product) {
                    $text = html_entity_decode(strip_tags((string) $product->short_description), ENT_QUOTES | ENT_HTML5, 'UTF-8');
                    $text = preg_replace('/[\h]+/u', ' ', $text);
                    $text = preg_replace('/\R{3,}/u', "\n\n", $text);
                    DB::table('products')->where('id', $product->id)->update([
                        'short_description' => trim($text),
                    ]);
                }
            });
    }

    public function down(): void
    {
        // Plain text cannot be safely converted back into the original WordPress HTML.
    }
};
