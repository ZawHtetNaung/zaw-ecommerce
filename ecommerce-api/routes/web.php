<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\SeoController;

Route::get('/robots.txt', [SeoController::class, 'robots']);

Route::get('/', function () {
    return response()->json([
        'message' => 'Ecommerce API is running.',
    ]);
});

Route::get('/reset-password/{token}', function (string $token) {
    $frontendUrl = rtrim(config('app.frontend_url'), '/');
    $email = request()->query('email', '');

    return redirect()->away($frontendUrl.'/reset-password?token='.$token.'&email='.urlencode($email));
})->name('password.reset');
