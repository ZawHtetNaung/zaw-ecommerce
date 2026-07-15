<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Favorite;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\Request;

class FavoriteController extends Controller
{
    public function index(Request $request)
    {
        return response()->json($this->payload($request->user()));
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
        ]);

        $product = Product::query()
            ->where('is_active', true)
            ->findOrFail($validated['product_id']);

        Favorite::query()->firstOrCreate([
            'user_id' => $request->user()->id,
            'product_id' => $product->id,
        ]);

        return response()->json($this->payload($request->user()), 201);
    }

    public function destroy(Request $request, Product $product)
    {
        Favorite::query()
            ->where('user_id', $request->user()->id)
            ->where('product_id', $product->id)
            ->delete();

        return response()->json($this->payload($request->user()));
    }

    private function payload(User $user): array
    {
        $products = $user->favoriteProducts()
            ->where('products.is_active', true)
            ->with([
                'category:id,name,slug',
                'subCategory:id,category_id,name,slug',
                'brand:id,name',
                'images',
            ])
            ->orderByDesc('favorites.created_at')
            ->get();

        return [
            'favorites' => $products,
            'count' => $products->count(),
        ];
    }
}
