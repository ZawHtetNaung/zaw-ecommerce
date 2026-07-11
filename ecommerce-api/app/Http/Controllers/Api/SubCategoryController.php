<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SubCategory;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SubCategoryController extends Controller
{
    public function index()
    {
        return response()->json(
            SubCategory::query()
                ->with('category:id,name')
                ->latest()
                ->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'image' => ['nullable', 'image', 'max:2048'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $request->validate([
            'name' => [
                Rule::unique('sub_categories', 'name')->where(
                    fn ($query) => $query->where('category_id', $validated['category_id'])
                ),
            ],
        ]);

        $validated['slug'] = Str::slug($validated['name']);
        $validated['is_active'] = $validated['is_active'] ?? true;

        if (SubCategory::where('slug', $validated['slug'])->exists()) {
            $validated['slug'] = $validated['slug'].'-'.Str::random(6);
        }

        if ($request->hasFile('image')) {
            $validated['image_path'] = $request->file('image')->store('sub-categories', 'public');
        }

        $subCategory = SubCategory::create($validated)->load('category:id,name');

        return response()->json([
            'message' => 'Sub category created successfully.',
            'sub_category' => $subCategory,
        ], 201);
    }

    public function show(SubCategory $subCategory)
    {
        return response()->json($subCategory->load('category:id,name'));
    }

    public function update(Request $request, SubCategory $subCategory)
    {
        $validated = $request->validate([
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'image' => ['nullable', 'image', 'max:2048'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $request->validate([
            'name' => [
                Rule::unique('sub_categories', 'name')
                    ->ignore($subCategory->id)
                    ->where(fn ($query) => $query->where('category_id', $validated['category_id'])),
            ],
        ]);

        $newSlug = Str::slug($validated['name']);
        if (
            $newSlug !== $subCategory->slug
            && SubCategory::where('slug', $newSlug)->where('id', '!=', $subCategory->id)->exists()
        ) {
            $newSlug = $newSlug.'-'.Str::random(6);
        }

        $updateData = [
            'category_id' => $validated['category_id'],
            'name' => $validated['name'],
            'slug' => $newSlug,
            'description' => $validated['description'] ?? null,
            'is_active' => $validated['is_active'] ?? $subCategory->is_active,
        ];

        if ($request->hasFile('image')) {
            if ($subCategory->image_path) {
                Storage::disk('public')->delete($subCategory->image_path);
            }
            $updateData['image_path'] = $request->file('image')->store('sub-categories', 'public');
        }

        $subCategory->update($updateData);

        return response()->json([
            'message' => 'Sub category updated successfully.',
            'sub_category' => $subCategory->fresh()->load('category:id,name'),
        ]);
    }

    public function destroy(SubCategory $subCategory)
    {
        if ($subCategory->image_path) {
            Storage::disk('public')->delete($subCategory->image_path);
        }

        $subCategory->delete();

        return response()->json([
            'message' => 'Sub category deleted successfully.',
        ]);
    }
}
