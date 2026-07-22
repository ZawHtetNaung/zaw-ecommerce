<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class GoogleReviewsService
{
    private const REQUEST_FIELDS = 'name,rating,user_ratings_total,reviews';

    public function getReviews(): array
    {
        $apiKey = trim((string) config('services.google_reviews.api_key', ''));
        $places = config('services.google_reviews.places', []);

        if ($apiKey === '' || ! is_array($places)) {
            return $this->emptyPayload();
        }

        $reviews = [];
        $totalReviews = 0;
        $weightedRatingSum = 0.0;
        $fallbackRatings = [];

        foreach ($places as $place) {
            if (! is_array($place)) {
                continue;
            }

            $label = $this->normalizeText($place['label'] ?? 'Messara Living');
            $placeId = trim((string) ($place['place_id'] ?? ''));

            if ($placeId === '') {
                continue;
            }

            $result = $this->getPlaceResult($placeId, $label, $apiKey);

            if ($result === null) {
                continue;
            }

            $placeName = $this->normalizeText($result['name'] ?? $label);
            $placeRating = max(0, (float) ($result['rating'] ?? 0));
            $placeTotal = max(0, (int) ($result['user_ratings_total'] ?? 0));

            if ($placeTotal > 0 && $placeRating > 0) {
                $totalReviews += $placeTotal;
                $weightedRatingSum += $placeRating * $placeTotal;
            } elseif ($placeRating > 0) {
                $fallbackRatings[] = $placeRating;
            }

            foreach ($result['reviews'] as $review) {
                if (! is_array($review)) {
                    continue;
                }

                $reviews[] = $this->normalizeReview(
                    $review,
                    $placeId,
                    $label,
                    $placeName !== '' ? $placeName : $label,
                );
            }
        }

        usort(
            $reviews,
            fn (array $first, array $second): int => $second['time'] <=> $first['time']
        );

        $rating = 0.0;

        if ($totalReviews > 0) {
            $rating = $weightedRatingSum / $totalReviews;
        } elseif ($fallbackRatings !== []) {
            $rating = array_sum($fallbackRatings) / count($fallbackRatings);
        }

        return [
            'name' => 'Messara Living',
            'rating' => round($rating, 2),
            'review_count' => $totalReviews,
            'reviews' => $reviews,
        ];
    }

    private function getPlaceResult(string $placeId, string $label, string $apiKey): ?array
    {
        $cacheKey = 'google_reviews.place.'.hash('sha256', $placeId);
        $cached = Cache::get($cacheKey);

        if (is_array($cached) && $this->hasReviews($cached)) {
            return $cached;
        }

        try {
            $response = Http::acceptJson()
                ->connectTimeout(5)
                ->timeout(15)
                ->get((string) config('services.google_reviews.endpoint'), [
                    'place_id' => $placeId,
                    'fields' => self::REQUEST_FIELDS,
                    'key' => $apiKey,
                ]);
        } catch (Throwable $exception) {
            // Do not log the exception message because an HTTP exception may contain
            // the request URL and therefore the API key.
            Log::warning('Google reviews request failed.', [
                'branch' => $label,
                'exception' => $exception::class,
            ]);

            return null;
        }

        $result = $this->validatedResult($response, $label);

        if ($result === null) {
            return null;
        }

        $cacheTtl = max(60, (int) config('services.google_reviews.cache_ttl', 21600));
        Cache::put($cacheKey, $result, now()->addSeconds($cacheTtl));

        return $result;
    }

    private function validatedResult(Response $response, string $label): ?array
    {
        if (! $response->successful()) {
            Log::warning('Google reviews returned an unsuccessful response.', [
                'branch' => $label,
                'status_code' => $response->status(),
            ]);

            return null;
        }

        $payload = $response->json();
        $status = is_array($payload) ? (string) ($payload['status'] ?? '') : '';
        $result = is_array($payload) ? ($payload['result'] ?? null) : null;

        if ($status !== 'OK' || ! is_array($result) || ! $this->hasReviews($result)) {
            Log::warning('Google reviews returned no usable review data.', [
                'branch' => $label,
                'google_status' => $status !== '' ? $status : 'UNKNOWN',
            ]);

            return null;
        }

        return $result;
    }

    private function hasReviews(array $result): bool
    {
        return isset($result['reviews'])
            && is_array($result['reviews'])
            && $result['reviews'] !== [];
    }

    private function normalizeReview(
        array $review,
        string $placeId,
        string $label,
        string $placeName,
    ): array {
        $authorName = $this->normalizeText($review['author_name'] ?? 'Google reviewer');
        $text = $this->normalizeText($review['text'] ?? '');
        $time = max(0, (int) ($review['time'] ?? 0));

        return [
            'id' => hash('sha256', implode('|', [$placeId, $authorName, (string) $time, $text])),
            'author_name' => $authorName !== '' ? $authorName : 'Google reviewer',
            'author_url' => $this->safeHttpsUrl($review['author_url'] ?? null),
            'profile_photo_url' => $this->safeHttpsUrl($review['profile_photo_url'] ?? null),
            'rating' => max(0, min(5, (int) ($review['rating'] ?? 0))),
            'text' => $text,
            'relative_time_description' => $this->normalizeText(
                $review['relative_time_description'] ?? ''
            ),
            'time' => $time,
            'branch' => $label,
            'place_name' => $placeName,
            'google_maps_url' => $this->googleMapsUrl($placeId, $placeName),
        ];
    }

    private function normalizeText(mixed $value): string
    {
        if (! is_string($value)) {
            return '';
        }

        $normalized = preg_replace('/\s+/u', ' ', strip_tags($value));

        return trim(is_string($normalized) ? $normalized : '');
    }

    private function safeHttpsUrl(mixed $value): ?string
    {
        if (! is_string($value) || filter_var($value, FILTER_VALIDATE_URL) === false) {
            return null;
        }

        return strtolower((string) parse_url($value, PHP_URL_SCHEME)) === 'https' ? $value : null;
    }

    private function googleMapsUrl(string $placeId, string $placeName): string
    {
        return 'https://www.google.com/maps/search/?api=1&query='.
            rawurlencode($placeName !== '' ? $placeName : 'Messara Living').
            '&query_place_id='.rawurlencode($placeId);
    }

    private function emptyPayload(): array
    {
        return [
            'name' => 'Messara Living',
            'rating' => 0.0,
            'review_count' => 0,
            'reviews' => [],
        ];
    }
}
