<?php

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ReconcileWordPressFaqs extends Command
{
    protected $signature = 'wordpress:reconcile-faqs {--database=i8055463_wp1}';
    protected $description = 'Recover FAQ pairs missed by compact or inline WordPress excerpt formatting';

    public function handle(): int
    {
        $base = config('database.connections.mysql');
        $base['database'] = $this->option('database');
        config(['database.connections.wordpress_faq_source' => $base]);
        DB::purge('wordpress_faq_source');

        $added = 0;
        Product::whereNotNull('wordpress_id')->with('faqs')->orderBy('id')->chunk(100, function ($products) use (&$added): void {
            $source = DB::connection('wordpress_faq_source')->table('wp_posts')
                ->whereIn('ID', $products->pluck('wordpress_id'))->pluck('post_excerpt', 'ID');
            foreach ($products as $product) {
                $pairs = $this->extract((string) ($source[$product->wordpress_id] ?? ''));
                $sort = (int) ($product->faqs->max('sort_order') ?? -1) + 1;
                foreach ($pairs as $pair) {
                    $exists = $product->faqs()->whereRaw('LOWER(question) = ?', [mb_strtolower($pair['question'])])->exists();
                    if ($exists) continue;
                    $product->faqs()->create($pair + ['sort_order' => $sort++]);
                    $added++;
                }
            }
        });

        $this->info("Recovered {$added} missing FAQ pairs from the WordPress source.");
        return self::SUCCESS;
    }

    private function extract(string $html): array
    {
        if ($html === '') return [];
        $html = preg_replace('/<(?:br)\b[^>]*>/iu', "\n", $html);
        $html = preg_replace('/<\/(?:p|h[1-6]|li|div)>/iu', "\n", $html);
        $text = html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $lines = array_values(array_filter(array_map('trim', preg_split('/\R/u', $text) ?: []), fn ($line) => $line !== ''));
        $header = null;
        foreach ($lines as $index => $line) {
            if (preg_match('/FAQs?|(?:common|frequently|customer).*(?:question|answer)/iu', $line)) { $header = $index; break; }
        }
        if ($header === null) return [];

        $tail = array_slice($lines, $header);
        $tail[0] = trim(preg_replace('/^.*?(?:FAQs?|(?:common|frequently|customer).*(?:question|answer))\s*[:!.-]*/iu', '', $tail[0]));
        $tail = array_values(array_filter($tail, fn ($line) => $line !== ''));
        $pairs = [];
        for ($index = 0; $index < count($tail); $index++) {
            $line = preg_replace('/^Q(?:uestion)?\s*\d*\s*[:.)-]\s*/iu', '', $tail[$index]);
            $questionEnd = mb_strpos($line, '?');
            if ($questionEnd === false) continue;
            $question = trim(mb_substr($line, 0, $questionEnd + 1));
            $answer = trim(mb_substr($line, $questionEnd + 1));
            if ($answer === '' && isset($tail[$index + 1])) $answer = trim($tail[++$index]);
            $answer = trim(preg_replace('/^(?:A(?:nswer)?\s*\d*\s*[:.)-]|✅)\s*/iu', '', $answer));
            if ($question !== '' && $answer !== '' && ! str_ends_with($answer, '?')) $pairs[] = compact('question', 'answer');
        }
        return $pairs;
    }
}
