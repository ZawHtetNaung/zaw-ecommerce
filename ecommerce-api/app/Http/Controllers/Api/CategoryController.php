<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Support\Str;

class CategoryController extends Controller
{
    public function publicIndex()
    {
        return response()->json(
            Category::query()
                ->select(['id', 'name', 'slug', 'image_path'])
                ->where('is_active', true)
                ->orderBy('id')
                ->get()
        );
    }

    public function publicShow(string $slug)
    {
        $category = Category::query()
            ->select(['id', 'name', 'slug', 'description', 'image_path'])
            ->where('slug', $slug)
            ->where('is_active', true)
            ->with([
                'subCategories' => fn ($query) => $query
                    ->select(['id', 'category_id', 'name', 'slug', 'description', 'image_path'])
                    ->where('is_active', true)
                    ->withCount([
                        'products as active_products_count' => fn ($productQuery) => $productQuery->where('is_active', true),
                    ])
                    ->orderBy('id'),
            ])
            ->withCount([
                'subCategories as active_sub_categories_count' => fn ($query) => $query->where('is_active', true),
                'products as active_products_count' => fn ($query) => $query->where('is_active', true),
            ])
            ->firstOrFail();

        return response()->json($category);
    }

    public function index()
    {
        return response()->json(
            Category::query()
                ->latest()
                ->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:categories,name'],
            'description' => ['nullable', 'string'],
            'image' => ['nullable', 'image', 'max:2048'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $validated['slug'] = Str::slug($validated['name']);
        $validated['is_active'] = $validated['is_active'] ?? true;

        if (Category::where('slug', $validated['slug'])->exists()) {
            $validated['slug'] = $validated['slug'].'-'.Str::random(6);
        }

        if ($request->hasFile('image')) {
            $validated['image_path'] = $request->file('image')->store('categories', 'public');
        }

        $category = Category::create($validated);

        return response()->json([
            'message' => 'Category created successfully.',
            'category' => $category,
        ], 201);
    }

    public function show(Category $category)
    {
        return response()->json($category);
    }

    public function update(Request $request, Category $category)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('categories', 'name')->ignore($category->id)],
            'description' => ['nullable', 'string'],
            'image' => ['nullable', 'image', 'max:2048'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $newSlug = Str::slug($validated['name']);
        if (
            $newSlug !== $category->slug
            && Category::where('slug', $newSlug)->where('id', '!=', $category->id)->exists()
        ) {
            $newSlug = $newSlug.'-'.Str::random(6);
        }

        $updateData = [
            'name' => $validated['name'],
            'slug' => $newSlug,
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'] ?? $category->is_active,
        ];

        if ($request->hasFile('image')) {
            if ($category->image_path) {
                Storage::disk('public')->delete($category->image_path);
            }
            $updateData['image_path'] = $request->file('image')->store('categories', 'public');
        }

        $category->update($updateData);

        return response()->json([
            'message' => 'Category updated successfully.',
            'category' => $category->fresh(),
        ]);
    }

    public function destroy(Category $category)
    {
        if ($category->image_path) {
            Storage::disk('public')->delete($category->image_path);
        }

        $category->delete();

        return response()->json([
            'message' => 'Category deleted successfully.',
        ]);
    }
}
