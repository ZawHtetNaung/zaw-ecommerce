<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BannerController;
use App\Http\Controllers\Api\BrandController;
use App\Http\Controllers\Api\CartController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\ColorController;
use App\Http\Controllers\Api\EventController;
use App\Http\Controllers\Api\FavoriteController;
use App\Http\Controllers\Api\MeasurementController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\SubCategoryController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);
Route::post('/reset-password', [AuthController::class, 'resetPassword']);
Route::get('/public/banners', [BannerController::class, 'publicIndex']);
Route::get('/public/categories', [CategoryController::class, 'publicIndex']);
Route::get('/public/products', [ProductController::class, 'publicIndex']);
Route::get('/public/product-filters', [ProductController::class, 'publicFilters']);
Route::get('/public/products/{productSlug}', [ProductController::class, 'publicShowBySlug']);
Route::get('/public/categories/{slug}', [CategoryController::class, 'publicShow']);
Route::get('/public/categories/{categorySlug}/sub-categories/{subCategorySlug}/products', [ProductController::class, 'publicIndexBySubCategory']);
Route::get('/public/categories/{categorySlug}/sub-categories/{subCategorySlug}/products/{productSlug}', [ProductController::class, 'publicShow']);
Route::get('/public/events', [EventController::class, 'publicIndex']);

Route::middleware('auth:sanctum')->group(function (): void {
    Route::get('/user', fn (\Illuminate\Http\Request $request) => $request->user());
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::get('/cart', [CartController::class, 'index']);
    Route::post('/cart', [CartController::class, 'store']);
    Route::patch('/cart/{cartItem}', [CartController::class, 'update']);
    Route::delete('/cart/{cartItem}', [CartController::class, 'destroy']);
    Route::delete('/cart', [CartController::class, 'clear']);
    Route::get('/favorites', [FavoriteController::class, 'index']);
    Route::post('/favorites', [FavoriteController::class, 'store']);
    Route::delete('/favorites/{product}', [FavoriteController::class, 'destroy']);
    Route::get('/users', [UserController::class, 'index']);
    Route::apiResource('/categories', CategoryController::class);
    Route::apiResource('/sub-categories', SubCategoryController::class);
    Route::apiResource('/brands', BrandController::class);
    Route::apiResource('/colors', ColorController::class);
    Route::apiResource('/measurements', MeasurementController::class);
    Route::apiResource('/products', ProductController::class);
    Route::apiResource('/events', EventController::class);
    Route::apiResource('/banners', BannerController::class);
    Route::post('/banners/reorder', [BannerController::class, 'reorder']);
    Route::post('/logout', [AuthController::class, 'logout']);
});
