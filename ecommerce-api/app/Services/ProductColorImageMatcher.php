<?php

namespace App\Services;

use Illuminate\Support\Collection;

final class ProductColorImageMatcher
{
    /**
     * @param  Collection<int, object>  $images
     * @return array{image: object, reason: string}|null
     */
    public function match(
        Collection $images,
        ?object $variation,
        string $colorName,
        string $colorSlug = '',
        string $colorImagePath = '',
        ?callable $fileHash = null
    ): ?array {
        if ($images->isEmpty()) {
            return null;
        }

        if ($variation) {
            $additionalAttachmentIds = preg_split(
                '/[\s,]+/',
                (string) ($variation->additional_attachment_ids ?? ''),
                -1,
                PREG_SPLIT_NO_EMPTY
            ) ?: [];

            foreach ($additionalAttachmentIds as $additionalAttachmentId) {
                $attachmentId = (int) $additionalAttachmentId;
                if ($attachmentId < 1) {
                    continue;
                }

                $variationGalleryMatch = $this->uniqueMatch(
                    $images,
                    fn (object $image): bool => str_starts_with(
                        basename((string) $image->path),
                        $attachmentId.'-'
                    )
                );

                if ($variationGalleryMatch) {
                    return ['image' => $variationGalleryMatch, 'reason' => 'variation_gallery_attachment'];
                }
            }

            $attachmentId = (int) ($variation->attachment_id ?? 0);
            if ($attachmentId > 0) {
                $exactAttachment = $this->uniqueMatch(
                    $images,
                    fn (object $image): bool => str_starts_with(
                        basename((string) $image->path),
                        $attachmentId.'-'
                    )
                );

                if ($exactAttachment) {
                    return ['image' => $exactAttachment, 'reason' => 'variation_attachment'];
                }
            }

            $variationPath = (string) ($variation->relative_path ?? '');
            $variationStem = $this->canonicalStem($variationPath);
            if ($variationStem !== '') {
                $filenameMatch = $this->uniqueMatch(
                    $images,
                    fn (object $image): bool => $this->canonicalStem((string) $image->path) === $variationStem
                );

                if ($filenameMatch) {
                    return ['image' => $filenameMatch, 'reason' => 'variation_filename'];
                }
            }
        }

        if ($colorImagePath !== '' && $fileHash) {
            $colorHash = $fileHash($colorImagePath);
            if ($colorHash) {
                $hashMatch = $this->uniqueMatch(
                    $images,
                    fn (object $image): bool => $fileHash((string) $image->path) === $colorHash
                );

                if ($hashMatch) {
                    return ['image' => $hashMatch, 'reason' => 'color_image_hash'];
                }
            }
        }

        $colorImageStem = $this->canonicalStem($colorImagePath);
        if ($colorImageStem !== '') {
            $colorImageMatch = $this->uniqueMatch(
                $images,
                fn (object $image): bool => $this->canonicalStem((string) $image->path) === $colorImageStem
            );

            if ($colorImageMatch) {
                return ['image' => $colorImageMatch, 'reason' => 'color_image_filename'];
            }
        }

        $colorTokens = $this->colorTokens($colorName, $colorSlug);
        if ($colorTokens === []) {
            return null;
        }

        $colorMatch = $this->uniqueMatch(
            $images,
            function (object $image) use ($colorTokens): bool {
                $imageStem = $this->canonicalStem((string) $image->path);

                return $imageStem !== ''
                    && collect($colorTokens)->every(
                        fn (string $token): bool => str_contains($imageStem, $token)
                    );
            }
        );

        return $colorMatch
            ? ['image' => $colorMatch, 'reason' => 'color_filename']
            : null;
    }

    /**
     * @param  Collection<int, object>  $images
     */
    private function uniqueMatch(Collection $images, callable $matches): ?object
    {
        $candidates = $images->filter($matches)->values();

        return $candidates->count() === 1 ? $candidates->first() : null;
    }

    private function canonicalStem(string $path): string
    {
        $stem = pathinfo(urldecode(basename($path)), PATHINFO_FILENAME);
        $stem = preg_replace('/^\d+-/', '', $stem) ?? $stem;
        $stem = preg_replace('/[-_]\d+x\d+$/i', '', $stem) ?? $stem;
        $stem = preg_replace('/[-_\s]+[a-z]$/i', '', $stem) ?? $stem;

        return strtolower(preg_replace('/[^a-z0-9]+/i', '', $stem) ?? '');
    }

    /**
     * @return list<string>
     */
    private function colorTokens(string $colorName, string $colorSlug): array
    {
        $source = trim($colorSlug.' '.$colorName);
        $tokens = preg_split('/[^a-z0-9]+/i', strtolower($source), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return collect($tokens)
            ->reject(fn (string $token): bool => in_array($token, ['color', 'colour', 'shade'], true))
            ->filter(fn (string $token): bool => strlen($token) >= 3)
            ->unique()
            ->values()
            ->all();
    }
}
