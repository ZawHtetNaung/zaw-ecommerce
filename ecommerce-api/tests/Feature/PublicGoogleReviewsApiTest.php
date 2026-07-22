<?php

namespace Tests\Feature;

use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PublicGoogleReviewsApiTest extends TestCase
{
    private const SHARJAH_PLACE_ID = 'test-sharjah-place';

    private const DUBAI_PLACE_ID = 'test-dubai-place';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.google_reviews.api_key' => 'test-google-key',
            'services.google_reviews.endpoint' => 'https://maps.googleapis.com/maps/api/place/details/json',
            'services.google_reviews.cache_ttl' => 21600,
            'services.google_reviews.places' => [
                ['label' => 'Sharjah Gallery', 'place_id' => self::SHARJAH_PLACE_ID],
                ['label' => 'Dubai Showroom', 'place_id' => self::DUBAI_PLACE_ID],
            ],
        ]);

        Cache::flush();
        Http::preventStrayRequests();
    }

    public function test_public_endpoint_combines_places_and_returns_weighted_newest_first_reviews(): void
    {
        Http::fake(function (Request $request) {
            $query = $this->queryFrom($request);

            if (($query['place_id'] ?? null) === self::SHARJAH_PLACE_ID) {
                return Http::response($this->placeResponse(
                    'Messara Living Sharjah',
                    4.8,
                    100,
                    [
                        $this->review('Sharjah Customer', 100, '<b>Wonderful</b> service'),
                    ],
                ));
            }

            return Http::response($this->placeResponse(
                'Messara Living Dubai',
                4.6,
                50,
                [
                    $this->review('Dubai Customer', 200, 'Excellent showroom'),
                ],
            ));
        });

        $response = $this->getJson('/api/public/google-reviews');

        $response->assertOk()
            ->assertJsonPath('name', 'Messara Living')
            ->assertJsonPath('rating', 4.73)
            ->assertJsonPath('review_count', 150)
            ->assertJsonCount(2, 'reviews')
            ->assertJsonPath('reviews.0.author_name', 'Dubai Customer')
            ->assertJsonPath('reviews.0.branch', 'Dubai Showroom')
            ->assertJsonPath('reviews.1.author_name', 'Sharjah Customer')
            ->assertJsonPath('reviews.1.text', 'Wonderful service')
            ->assertJsonPath('reviews.1.branch', 'Sharjah Gallery')
            ->assertJsonPath(
                'reviews.1.google_maps_url',
                fn (mixed $url): bool => is_string($url)
                    && str_starts_with($url, 'https://www.google.com/maps/search/?api=1')
                    && str_contains($url, 'query_place_id='.self::SHARJAH_PLACE_ID)
            );

        Http::assertSentCount(2);
        Http::assertSent(function (Request $request): bool {
            $query = $this->queryFrom($request);

            return $request->method() === 'GET'
                && ($query['fields'] ?? null) === 'name,rating,user_ratings_total,reviews'
                && ($query['key'] ?? null) === 'test-google-key';
        });

        $this->assertStringNotContainsString('test-google-key', $response->getContent());
    }

    public function test_successful_place_responses_are_cached_separately_for_six_hours(): void
    {
        Http::fake(fn (Request $request) => Http::response($this->placeResponse(
            'Messara Living',
            4.9,
            10,
            [$this->review('Customer', 100, 'Great')],
        )));

        $this->getJson('/api/public/google-reviews')->assertOk();
        $this->getJson('/api/public/google-reviews')->assertOk();

        Http::assertSentCount(2);

        foreach ([self::SHARJAH_PLACE_ID, self::DUBAI_PLACE_ID] as $placeId) {
            $this->assertTrue(Cache::has('google_reviews.place.'.hash('sha256', $placeId)));
        }
    }

    public function test_failed_place_is_not_cached_and_other_place_still_returns(): void
    {
        Http::fake(function (Request $request) {
            $placeId = $this->queryFrom($request)['place_id'] ?? null;

            if ($placeId === self::SHARJAH_PLACE_ID) {
                return Http::response(['status' => 'REQUEST_DENIED'], 200);
            }

            return Http::response($this->placeResponse(
                'Messara Living Dubai',
                4.7,
                75,
                [$this->review('Dubai Customer', 200, 'Helpful team')],
            ));
        });

        $this->getJson('/api/public/google-reviews')
            ->assertOk()
            ->assertJsonPath('rating', 4.7)
            ->assertJsonPath('review_count', 75)
            ->assertJsonCount(1, 'reviews')
            ->assertJsonPath('reviews.0.branch', 'Dubai Showroom');

        $this->getJson('/api/public/google-reviews')->assertOk();

        Http::assertSentCount(3);
        $this->assertFalse(Cache::has(
            'google_reviews.place.'.hash('sha256', self::SHARJAH_PLACE_ID)
        ));
        $this->assertTrue(Cache::has(
            'google_reviews.place.'.hash('sha256', self::DUBAI_PLACE_ID)
        ));
    }

    public function test_unavailable_places_return_a_stable_empty_success_response(): void
    {
        Http::fake(fn () => Http::response(['status' => 'UNKNOWN_ERROR'], 500));

        $this->getJson('/api/public/google-reviews')
            ->assertOk()
            ->assertExactJson([
                'name' => 'Messara Living',
                'rating' => 0,
                'review_count' => 0,
                'reviews' => [],
            ]);

        Http::assertSentCount(2);
    }

    public function test_missing_api_key_returns_empty_response_without_an_outbound_request(): void
    {
        config(['services.google_reviews.api_key' => null]);
        Http::fake();

        $this->getJson('/api/public/google-reviews')
            ->assertOk()
            ->assertJsonPath('rating', 0)
            ->assertJsonPath('review_count', 0)
            ->assertJsonCount(0, 'reviews');

        Http::assertNothingSent();
    }

    public function test_review_response_whitelists_fields_and_rejects_non_https_profile_links(): void
    {
        Http::fake(fn () => Http::response($this->placeResponse(
            'Messara Living',
            5,
            1,
            [[
                'author_name' => 'Customer',
                'author_url' => 'javascript:alert(1)',
                'profile_photo_url' => 'http://example.com/avatar.jpg',
                'rating' => 9,
                'text' => '<script>alert(1)</script> Lovely',
                'relative_time_description' => 'a week ago',
                'time' => 300,
                'unexpected_upstream_field' => 'must-not-leak',
            ]],
        )));

        $response = $this->getJson('/api/public/google-reviews')->assertOk();

        $response->assertJsonPath('reviews.0.author_url', null)
            ->assertJsonPath('reviews.0.profile_photo_url', null)
            ->assertJsonPath('reviews.0.rating', 5)
            ->assertJsonMissing(['unexpected_upstream_field' => 'must-not-leak']);

        $this->assertStringNotContainsString('test-google-key', $response->getContent());
    }

    private function placeResponse(
        string $name,
        float $rating,
        int $total,
        array $reviews,
    ): array {
        return [
            'status' => 'OK',
            'result' => [
                'name' => $name,
                'rating' => $rating,
                'user_ratings_total' => $total,
                'reviews' => $reviews,
            ],
        ];
    }

    private function review(string $author, int $time, string $text): array
    {
        return [
            'author_name' => $author,
            'author_url' => 'https://example.com/customer',
            'profile_photo_url' => 'https://example.com/avatar.jpg',
            'rating' => 5,
            'text' => $text,
            'relative_time_description' => 'recently',
            'time' => $time,
        ];
    }

    private function queryFrom(Request $request): array
    {
        parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $query);

        return $query;
    }
}
