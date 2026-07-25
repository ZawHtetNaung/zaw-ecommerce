<?php

namespace Tests\Unit;

use App\Services\ProductColorImageMatcher;
use PHPUnit\Framework\TestCase;

class ProductColorImageMatcherTest extends TestCase
{
    public function test_it_prefers_an_exact_wordpress_attachment_id(): void
    {
        $match = (new ProductColorImageMatcher)->match(
            collect([
                (object) ['id' => 10, 'path' => 'products/123-blue-chair.jpg'],
                (object) ['id' => 11, 'path' => 'products/456-red-chair.jpg'],
            ]),
            (object) ['attachment_id' => 456, 'relative_path' => '2022/red-chair.jpg'],
            'Red'
        );

        $this->assertSame(11, $match['image']->id);
        $this->assertSame('variation_attachment', $match['reason']);
    }

    public function test_it_matches_original_filename_variants_without_copying_a_new_image(): void
    {
        $match = (new ProductColorImageMatcher)->match(
            collect([
                (object) ['id' => 10783, 'path' => 'products/13379-tablecafepatio-bourgogne-c.jpg'],
                (object) ['id' => 10784, 'path' => 'products/13376-tablecafepatio-bleuprovence-c.jpg'],
            ]),
            (object) [
                'attachment_id' => 13377,
                'relative_path' => '2021/12/TablecafePATIO_Bourgogne_A.jpg',
            ],
            'Mehroon'
        );

        $this->assertSame(10783, $match['image']->id);
        $this->assertSame('variation_filename', $match['reason']);
    }

    public function test_it_uses_the_first_existing_woodmart_variation_gallery_image(): void
    {
        $match = (new ProductColorImageMatcher)->match(
            collect([
                (object) ['id' => 10783, 'path' => 'products/13379-tablecafepatio-bourgogne-c.jpg'],
                (object) ['id' => 10784, 'path' => 'products/13376-tablecafepatio-bleuprovence-c.jpg'],
            ]),
            (object) [
                'attachment_id' => 13374,
                'relative_path' => '2021/12/TablecafePATIO_BleuProvence_A.jpg',
                'additional_attachment_ids' => '13376,13375',
            ],
            'Blue Ocean'
        );

        $this->assertSame(10784, $match['image']->id);
        $this->assertSame('variation_gallery_attachment', $match['reason']);
    }

    public function test_it_uses_a_unique_color_filename_when_wordpress_has_no_variation(): void
    {
        $match = (new ProductColorImageMatcher)->match(
            collect([
                (object) ['id' => 1, 'path' => 'products/chair-blue-ocean.jpg'],
                (object) ['id' => 2, 'path' => 'products/chair-sand-beige.jpg'],
            ]),
            null,
            'Blue Ocean',
            'blue-ocean'
        );

        $this->assertSame(1, $match['image']->id);
        $this->assertSame('color_filename', $match['reason']);
    }

    public function test_it_matches_an_existing_gallery_image_with_the_same_color_asset_hash(): void
    {
        $hashes = [
            'colors/blue-swatch.jpg' => 'matching-content',
            'products/blue-room.jpg' => 'matching-content',
            'products/grey-room.jpg' => 'different-content',
        ];
        $match = (new ProductColorImageMatcher)->match(
            collect([
                (object) ['id' => 1, 'path' => 'products/blue-room.jpg'],
                (object) ['id' => 2, 'path' => 'products/grey-room.jpg'],
            ]),
            null,
            'Ocean',
            'ocean',
            'colors/blue-swatch.jpg',
            fn (string $path): ?string => $hashes[$path] ?? null
        );

        $this->assertSame(1, $match['image']->id);
        $this->assertSame('color_image_hash', $match['reason']);
    }

    public function test_it_refuses_an_ambiguous_filename_match(): void
    {
        $match = (new ProductColorImageMatcher)->match(
            collect([
                (object) ['id' => 1, 'path' => 'products/red-chair-front.jpg'],
                (object) ['id' => 2, 'path' => 'products/red-chair-side.jpg'],
            ]),
            null,
            'Red',
            'red'
        );

        $this->assertNull($match);
    }
}
