<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\GoogleReviewsService;
use Illuminate\Http\JsonResponse;

class GoogleReviewController extends Controller
{
    public function publicIndex(GoogleReviewsService $googleReviews): JsonResponse
    {
        return response()->json($googleReviews->getReviews());
    }
}
