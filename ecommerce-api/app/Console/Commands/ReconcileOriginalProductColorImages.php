<?php

namespace App\Console\Commands;

use App\Models\ProductImage;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ReconcileOriginalProductColorImages extends Command
{
    protected $signature = 'wordpress:reconcile-original-color-gallery
        {--added-min-id=10816 : First product_images ID created by the variation-copy pass}
        {--added-max-id=11428 : Last product_images ID created by the variation-copy pass}
        {--apply : Apply the remaps and remove the added gallery rows/files}';

    protected $description = 'Remove copied variation slides and link colors only to safe pre-existing gallery images';

    public function handle(): int
    {
        $min = (int) $this->option('added-min-id');
        $max = (int) $this->option('added-max-id');
        $added = ProductImage::query()->whereBetween('id', [$min, $max])->get();

        if ($added->count() !== 613) {
            $this->error("Safety check failed: expected 613 added rows, found {$added->count()}.");
            return self::FAILURE;
        }

        $addedIds = $added->pluck('id');
        $links = DB::table('color_product as cp')
            ->join('colors as c', 'c.id', '=', 'cp.color_id')
            ->whereIn('cp.product_image_id', $addedIds)
            ->get(['cp.product_id', 'cp.color_id', 'cp.product_image_id', 'c.name']);

        $remaps = [];
        $reasons = ['hash' => 0, 'filename' => 0, 'color' => 0];
        foreach ($links as $link) {
            if ($links->where('product_image_id', $link->product_image_id)->count() > 1) {
                continue;
            }
            $copied = $added->firstWhere('id', $link->product_image_id);
            $originals = ProductImage::query()
                ->where('product_id', $link->product_id)
                ->where('id', '<', $min)
                ->get();
            [$candidate, $reason] = $this->safeCandidate($copied, $originals, $link->name);
            if ($candidate) {
                $reasons[$reason]++;
                $remaps[] = [
                    'product_id' => $link->product_id,
                    'color_id' => $link->color_id,
                    'from' => $link->product_image_id,
                    'to' => $candidate->id,
                    'color' => $link->name,
                    'reason' => $reason,
                ];
            }
        }

        $this->info("Added gallery rows: {$added->count()}; color links using them: {$links->count()}.");
        $this->info('Safe links to pre-existing gallery images: '.count($remaps).'.');
        $this->line("Evidence: {$reasons['hash']} identical files, {$reasons['filename']} filename matches, {$reasons['color']} color-token matches.");

        if (! $this->option('apply')) {
            $this->table(['Product', 'Color', 'From', 'To'], collect($remaps)->where('reason', 'color')->map(fn (array $row): array => [$row['product_id'], $row['color'], $row['from'], $row['to']])->all());
            $this->warn('Dry run only. Pass --apply after reviewing these totals.');
            return self::SUCCESS;
        }

        DB::transaction(function () use ($addedIds, $remaps): void {
            foreach ($remaps as $remap) {
                DB::table('color_product')
                    ->where('product_id', $remap['product_id'])
                    ->where('color_id', $remap['color_id'])
                    ->where('product_image_id', $remap['from'])
                    ->update(['product_image_id' => $remap['to']]);
            }

            DB::table('color_product')->whereIn('product_image_id', $addedIds)->update(['product_image_id' => null]);
            ProductImage::query()->whereIn('id', $addedIds)->delete();
        });

        $deletedFiles = 0;
        $preservedFiles = 0;
        foreach ($added->pluck('path')->unique() as $path) {
            $stillReferenced = ProductImage::query()->where('path', $path)->exists()
                || DB::table('products')->where('image_path', $path)->exists();
            if ($stillReferenced) {
                $preservedFiles++;
                continue;
            }
            if (Storage::disk('public')->exists($path) && Storage::disk('public')->delete($path)) {
                $deletedFiles++;
            }
        }

        $this->info("Removed 613 added gallery rows and {$deletedFiles} exclusive files; preserved {$preservedFiles} referenced files.");
        return self::SUCCESS;
    }

    private function safeCandidate(ProductImage $copied, Collection $originals, string $colorName): array
    {
        if ($originals->isEmpty()) {
            return [null, null];
        }

        $copiedPath = Storage::disk('public')->path($copied->path);
        if (is_file($copiedPath)) {
            $hash = hash_file('sha256', $copiedPath);
            $matches = $originals->filter(function (ProductImage $image) use ($hash): bool {
                $path = Storage::disk('public')->path($image->path);
                return is_file($path) && hash_file('sha256', $path) === $hash;
            });
            if ($matches->count() === 1) {
                return [$matches->first(), 'hash'];
            }
        }

        $copiedStem = $this->normalizedStem($copied->path);
        $matches = $originals->filter(fn (ProductImage $image): bool => $this->normalizedStem($image->path) === $copiedStem);
        if ($matches->count() === 1) {
            return [$matches->first(), 'filename'];
        }

        $tokens = collect(explode('-', Str::slug($colorName)))
            ->filter(fn (string $token): bool => strlen($token) >= 3)
            ->values();
        if ($tokens->isEmpty()) {
            return [null, null];
        }
        $matches = $originals->filter(function (ProductImage $image) use ($tokens): bool {
            $stemTokens = collect(explode('-', Str::slug(pathinfo($image->path, PATHINFO_FILENAME))));
            return $tokens->every(fn (string $token): bool => $stemTokens->contains($token));
        });

        return $matches->count() === 1 ? [$matches->first(), 'color'] : [null, null];
    }

    private function normalizedStem(string $path): string
    {
        $stem = Str::slug(pathinfo($path, PATHINFO_FILENAME));
        return preg_replace('/^\d+-/', '', $stem);
    }
}
