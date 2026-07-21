<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_faqs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->text('question');
            $table->text('answer');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        DB::table('products')->whereNotNull('short_description')->select(['id', 'short_description'])->orderBy('id')
            ->chunkById(100, function ($products): void {
                foreach ($products as $product) {
                    [$description, $faqs] = $this->extract((string) $product->short_description);
                    if ($faqs === []) {
                        continue;
                    }
                    DB::table('products')->where('id', $product->id)->update(['short_description' => $description ?: null]);
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

    private function extract(string $text): array
    {
        $text = str_replace(['\\r\\n', '\\n', "\r\n", "\r"], "\n", $text);
        $lines = preg_split('/\n/u', $text) ?: [];
        $firstQuestion = null;
        foreach ($lines as $index => $line) {
            if (preg_match('/^\s*Q(?:uestion)?\s*\d*\s*[:.)-]\s*/iu', trim($line))) {
                $firstQuestion = $index;
                break;
            }
        }
        if ($firstQuestion === null) {
            return [$text, []];
        }

        $descriptionLines = array_slice($lines, 0, $firstQuestion);
        $descriptionLines = array_values(array_filter($descriptionLines, fn ($line) => ! preg_match(
            '/^\s*[^\pL\pN]*(?:(?:common|frequently|customer).*(?:question|answer)|questions?\s*(?:&|and)\s*answers?)[^\pL\pN]*$/iu',
            trim($line)
        )));

        $faqs = [];
        $current = null;
        foreach (array_slice($lines, $firstQuestion) as $line) {
            $line = trim($line);
            if ($line === '') continue;
            if (preg_match('/^Q(?:uestion)?\s*\d*\s*[:.)-]\s*(.+)$/iu', $line, $match)) {
                if ($current && $current['question'] !== '' && $current['answer'] !== '') $faqs[] = $current;
                $questionAndAnswer = trim($match[1]);
                $questionEnd = mb_strpos($questionAndAnswer, '?');
                $current = ['question' => $questionAndAnswer, 'answer' => ''];
                if ($questionEnd !== false && $questionEnd < mb_strlen($questionAndAnswer) - 1) {
                    $current['question'] = trim(mb_substr($questionAndAnswer, 0, $questionEnd + 1));
                    $current['answer'] = trim(mb_substr($questionAndAnswer, $questionEnd + 1));
                }
                continue;
            }
            if (! $current) continue;
            $line = preg_replace('/^(?:A(?:nswer)?\s*\d*\s*[:.)-])\s*/iu', '', $line);
            $line = preg_replace('/^[\x{2705}\x{FE0F}\s]+/u', '', $line);
            $current['answer'] = trim($current['answer'].' '.$line);
        }
        if ($current && $current['question'] !== '' && $current['answer'] !== '') $faqs[] = $current;

        return [trim(implode("\n", $descriptionLines)), $faqs];
    }

    public function down(): void
    {
        Schema::dropIfExists('product_faqs');
    }
};
