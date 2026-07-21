<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('product_faqs')->select(['id', 'question', 'answer'])->orderBy('id')->chunkById(300, function ($faqs): void {
            foreach ($faqs as $faq) {
                DB::table('product_faqs')->where('id', $faq->id)->update([
                    'question' => trim(preg_replace('/^Q(?:uestion)?\s*\d*\s*[:.)-]\s*/iu', '', $faq->question)),
                    'answer' => trim(preg_replace('/^A(?:nswer)?\s*\d*\s*[:.)-]\s*/iu', '', $faq->answer)),
                ]);
            }
        });
    }

    public function down(): void {}
};
