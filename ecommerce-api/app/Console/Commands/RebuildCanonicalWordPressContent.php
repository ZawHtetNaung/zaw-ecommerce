<?php

namespace App\Console\Commands;

use App\Models\Brand;
use App\Models\Color;
use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RebuildCanonicalWordPressContent extends Command
{
    protected $signature = 'wordpress:rebuild-canonical-content
        {--database=i8055463_wp1 : Canonical WordPress database}
        {--apply : Apply canonical text, SEO, alt text, and FAQ cleanup}';

    protected $description = 'Replace staging mojibake with canonical WordPress content and rebuild normalized FAQs';

    public function handle(): int
    {
        $base = config('database.connections.mysql');
        $base['database'] = $this->option('database');
        config(['database.connections.wordpress_canonical' => $base]);
        DB::purge('wordpress_canonical');
        $wp = DB::connection('wordpress_canonical');

        $products = Product::with('faqs')->whereNotNull('wordpress_id')->orderBy('id')->get();
        $posts = $wp->table('wp_posts')->whereIn('ID', $products->pluck('wordpress_id'))
            ->get(['ID', 'post_title', 'post_excerpt', 'post_content'])->keyBy('ID');
        $postMeta = $wp->table('wp_postmeta')
            ->whereIn('post_id', $products->pluck('wordpress_id'))
            ->whereIn('meta_key', ['_yoast_wpseo_title', '_yoast_wpseo_metadesc', 'rank_math_title', 'rank_math_description'])
            ->get(['post_id', 'meta_key', 'meta_value'])->groupBy('post_id')->map(fn ($rows) => $rows->pluck('meta_value', 'meta_key'));

        $updates = [];
        $faqRebuilds = [];
        $mojibakeRepairs = 0;
        $faqBefore = 0;
        $faqAfter = 0;
        $longAnswers = 0;
        foreach ($products as $product) {
            $post = $posts[$product->wordpress_id] ?? null;
            if (! $post) continue;
            $meta = $postMeta[$product->wordpress_id] ?? collect();
            $repairedShort = $this->repairCp850((string) ($product->short_description ?? ''));
            if ($repairedShort !== (string) ($product->short_description ?? '')) $mojibakeRepairs++;

            $updates[] = [$product, [
                'name' => html_entity_decode((string) $post->post_title, ENT_QUOTES | ENT_HTML5, 'UTF-8'),
                'short_description' => $repairedShort !== '' ? $repairedShort : null,
                'description' => trim((string) $post->post_content) !== '' ? (string) $post->post_content : null,
                'seo_title' => $this->nullable($meta['rank_math_title'] ?? $meta['_yoast_wpseo_title'] ?? null),
                'seo_description' => $this->nullable($meta['rank_math_description'] ?? $meta['_yoast_wpseo_metadesc'] ?? null),
            ]];

            $faqBefore += $product->faqs->count();
            $pairs = $this->canonicalFaqs((string) $post->post_excerpt);
            $merged = [];
            foreach ($product->faqs as $faq) {
                $question = $this->cleanQuestion($this->repairCp850((string) $faq->question));
                $answer = $this->cleanAnswer($this->repairCp850((string) $faq->answer));
                if ($question === '' || $answer === '') continue;
                $key = $this->questionKey($question);
                if (! isset($merged[$key]) || mb_strlen($answer) < mb_strlen($merged[$key]['answer'])) {
                    $merged[$key] = compact('question', 'answer');
                }
            }
            foreach ($pairs as $pair) {
                $merged[$this->questionKey($pair['question'])] = $pair;
            }
            $merged = array_values($merged);
            foreach ($merged as $pair) if (mb_strlen($pair['answer']) > 500) $longAnswers++;
            $faqAfter += count($merged);
            $faqRebuilds[] = [$product, $merged];
        }

        $attachmentIds = ProductImage::query()->get()->map(function (ProductImage $image): ?int {
            return preg_match('/^(\d+)-/', basename($image->path), $match) ? (int) $match[1] : null;
        })->filter()->unique()->values();
        $altByAttachment = $wp->table('wp_postmeta')->whereIn('post_id', $attachmentIds)
            ->where('meta_key', '_wp_attachment_image_alt')->where('meta_value', '<>', '')
            ->pluck('meta_value', 'post_id');
        $imageAltUpdates = ProductImage::query()->get()->map(function (ProductImage $image) use ($altByAttachment) {
            if (! preg_match('/^(\d+)-/', basename($image->path), $match)) return null;
            $alt = $altByAttachment[(int) $match[1]] ?? null;
            return $alt !== null ? [$image, mb_substr((string) $alt, 0, 255)] : null;
        })->filter()->values();

        $termNames = $wp->table('wp_terms')->pluck('name', 'term_id');
        $brandUpdates = Brand::whereNotNull('wordpress_id')->get()->map(fn (Brand $brand) => isset($termNames[$brand->wordpress_id]) ? [$brand, html_entity_decode($termNames[$brand->wordpress_id], ENT_QUOTES | ENT_HTML5, 'UTF-8')] : null)->filter();
        $colorUpdates = Color::whereNotNull('wordpress_term_id')->get()->map(fn (Color $color) => isset($termNames[$color->wordpress_term_id]) ? [$color, html_entity_decode($termNames[$color->wordpress_term_id], ENT_QUOTES | ENT_HTML5, 'UTF-8')] : null)->filter();

        $this->info('Products canonicalized: '.count($updates)."; short-description encoding repairs: {$mojibakeRepairs}.");
        $this->info("FAQs: {$faqBefore} rows before, {$faqAfter} normalized rows after; answers still over 500 characters: {$longAnswers}.");
        $this->info('Canonical product-image alt texts available: '.$imageAltUpdates->count().'.');

        if (! $this->option('apply')) {
            $sample = collect($updates)->filter(fn ($row) => $row[0]->short_description !== $row[1]['short_description'])->take(3)
                ->map(fn ($row) => [$row[0]->wordpress_id, mb_substr((string) $row[0]->short_description, 0, 80), mb_substr((string) $row[1]['short_description'], 0, 80)])->all();
            $this->table(['WP ID', 'Before', 'After'], $sample);
            $this->warn('Dry run only. Pass --apply to save this canonical rebuild.');
            return self::SUCCESS;
        }

        DB::transaction(function () use ($updates, $faqRebuilds, $imageAltUpdates, $brandUpdates, $colorUpdates): void {
            foreach ($updates as [$product, $data]) $product->update($data);
            foreach ($faqRebuilds as [$product, $pairs]) {
                $product->faqs()->delete();
                foreach ($pairs as $sort => $pair) $product->faqs()->create($pair + ['sort_order' => $sort]);
            }
            foreach ($imageAltUpdates as [$image, $alt]) $image->update(['alt_text' => $alt]);
            foreach ($brandUpdates as [$brand, $name]) $brand->update(['name' => $name]);
            foreach ($colorUpdates as [$color, $name]) $color->update(['name' => $name]);
        });
        $this->info('Canonical WordPress content rebuild applied.');
        return self::SUCCESS;
    }

    private function canonicalFaqs(string $html): array
    {
        if ($html === '') return [];
        $blockPairs = [];
        if (preg_match_all('/<h[2-6]\b[^>]*>(.*?)<\/h[2-6]>\s*<p\b[^>]*>(.*?)<\/p>/isu', $html, $headingPairs, PREG_SET_ORDER)) {
            foreach ($headingPairs as $headingPair) {
                $question = $this->cleanQuestion(html_entity_decode(strip_tags($headingPair[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
                $answer = $this->cleanAnswer(html_entity_decode(strip_tags(preg_replace('/<br\b[^>]*>/iu', ' ', $headingPair[2])), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
                if (str_ends_with($question, '?') && $answer !== '' && mb_strlen($answer) <= 500) {
                    $blockPairs[$this->questionKey($question)] = compact('question', 'answer');
                }
            }
        }
        if (preg_match_all('/<(?:p|li)\b[^>]*>(.*?)<\/(?:p|li)>/isu', $html, $blocks)) {
            foreach ($blocks[1] as $block) {
                $block = preg_replace('/<br\b[^>]*>|<\/strong>/iu', ' ', $block);
                $block = trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($block), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
                $hasLabel = preg_match('/^[^\pL\pN]*(?:Q(?:uestion)?\s*)?\d+\s*[:.)-]/iu', $block)
                    || preg_match('/^[^\pL\pN]*Q(?:uestion)?\s*[:.)-]/iu', $block);
                if (! $hasLabel) continue;
                $block = preg_replace('/^[^\pL\pN]*(?:Q(?:uestion)?\s*)?\d*\s*[:.)-]\s*/iu', '', $block);
                $questionEnd = mb_strpos($block, '?');
                if ($questionEnd === false) continue;
                $question = $this->cleanQuestion(mb_substr($block, 0, $questionEnd + 1));
                $answer = $this->cleanAnswer(mb_substr($block, $questionEnd + 1));
                if ($question !== '' && $answer !== '' && mb_strlen($answer) <= 500) {
                    $blockPairs[$this->questionKey($question)] = compact('question', 'answer');
                }
            }
        }
        if ($blockPairs !== []) return array_values($blockPairs);

        $text = preg_replace('/<br\b[^>]*>/iu', "\n", $html);
        $text = preg_replace('/<\/(?:p|li|h[1-6]|div|strong)>/iu', "\n", $text);
        $text = html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $lines = array_values(array_filter(array_map(fn ($line) => trim(preg_replace('/\s+/u', ' ', $line)), preg_split('/\R/u', $text) ?: []), fn ($line) => $line !== ''));
        $header = null;
        foreach ($lines as $index => $line) {
            if (preg_match('/(?:common|frequently\s+asked|customer).*(?:questions?|answers?)|\bFAQs?\b/iu', $line)) { $header = $index; break; }
        }
        $scan = $header !== null ? array_slice($lines, $header + 1) : $lines;
        $pairs = [];
        for ($index = 0; $index < count($scan); $index++) {
            $line = $scan[$index];
            $hasLabel = preg_match('/^[^\pL\pN]*(?:Q(?:uestion)?\s*)?\d+\s*[:.)-]/iu', $line)
                || preg_match('/^[^\pL\pN]*Q(?:uestion)?\s*[:.)-]/iu', $line);
            if (! $hasLabel) continue;
            $line = preg_replace('/^[^\pL\pN]*(?:Q(?:uestion)?\s*)?\d*\s*[:.)-]\s*/iu', '', $line);
            $questionEnd = mb_strpos($line, '?');
            if ($questionEnd === false) continue;
            $question = $this->cleanQuestion(mb_substr($line, 0, $questionEnd + 1));
            $answerParts = array_values(array_filter([trim(mb_substr($line, $questionEnd + 1))]));
            while (isset($scan[$index + 1])) {
                $next = trim($scan[$index + 1]);
                $nextIsQuestion = preg_match('/^[^\pL\pN]*(?:Q(?:uestion)?\s*)?\d+\s*[:.)-]/iu', $next)
                    || preg_match('/^[^\pL\pN]*Q(?:uestion)?\s*[:.)-]/iu', $next);
                if ($nextIsQuestion || str_starts_with(strtolower($next), '[embed]')) break;
                if (preg_match('/^(?:dimensions?|specifications?|technical details?|product details?|price|materials?|features?)\s*:?[\s]*$/iu', $next)) break;
                $answerParts[] = $next;
                $index++;
            }
            $answer = $this->cleanAnswer(implode(' ', $answerParts));
            if ($question !== '' && $answer !== '' && mb_strlen($answer) <= 500) $pairs[$this->questionKey($question)] = compact('question', 'answer');
        }
        return array_values($pairs);
    }

    private function repairCp850(string $value): string
    {
        if ($value === '' || ! preg_match('/[Ô┬├╬]/u', $value)) return $value;
        $converted = @iconv('UTF-8', 'CP850//IGNORE', $value);
        return is_string($converted) && mb_check_encoding($converted, 'UTF-8') ? $converted : $value;
    }

    private function cleanQuestion(string $value): string
    {
        $value = trim(preg_replace('/\s+/u', ' ', $value));
        $value = preg_replace('/^[^\pL\pN]*(?:Q(?:uestion)?\s*)?\d*\s*[:.)-]\s*/iu', '', $value);
        $value = preg_replace('/^(?:(?:common|frequently asked|customer)\s+questions?|FAQs?)\s*[:.-]?\s*/iu', '', $value);
        return trim($value);
    }

    private function cleanAnswer(string $value): string
    {
        $value = preg_replace('/\[embed\].*?\[\/embed\]/isu', '', $value);
        $value = preg_replace('/^[^\pL\pN]*A(?:nswer)?\s*\d*\s*[:.)-]\s*/iu', '', $value);
        if (preg_match('/\s+(?:Q(?:uestion)?\s*\d*\s*[:.)-]).*$/isu', $value, $match, PREG_OFFSET_CAPTURE)) {
            $value = substr($value, 0, $match[0][1]);
        }
        $value = trim(preg_replace('/\s+/u', ' ', $value));
        return preg_replace('/\s+([,.;:!?])/u', '$1', $value);
    }

    private function questionKey(string $question): string
    {
        $key = mb_strtolower($this->cleanQuestion($question));
        return preg_replace('/[^\pL\pN]+/u', '', $key);
    }

    private function nullable($value): ?string
    {
        $value = trim((string) $value);
        return $value === '' ? null : $value;
    }
}
