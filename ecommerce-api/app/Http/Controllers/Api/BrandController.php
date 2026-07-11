<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Brand;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class BrandController extends Controller
{
    public function index()
    {
        return response()->json(
            Brand::query()->latest()->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:brands,name'],
            'image' => ['nullable', 'image', 'max:2048'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $validated['slug'] = Str::slug($validated['name']);
        $validated['is_active'] = $validated['is_active'] ?? true;

        if (Brand::where('slug', $validated['slug'])->exists()) {
            $validated['slug'] = $validated['slug'].'-'.Str::random(6);
        }

        if ($request->hasFile('image')) {
            $validated['image_path'] = $request->file('image')->store('brands', 'public');
        }

        $brand = Brand::create($validated);

        return response()->json([
            'message' => 'Brand created successfully.',
            'brand' => $brand,
        ], 201);
    }

    public function show(Brand $brand)
    {
        return response()->json($brand);
    }

    public function update(Request $request, Brand $brand)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('brands', 'name')->ignore($brand->id)],
            'image' => ['nullable', 'image', 'max:2048'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $newSlug = Str::slug($validated['name']);
        if (
            $newSlug !== $brand->slug
            && Brand::where('slug', $newSlug)->where('id', '!=', $brand->id)->exists()
        ) {
            $newSlug = $newSlug.'-'.Str::random(6);
        }

        $updateData = [
            'name' => $validated['name'],
            'slug' => $newSlug,
            'is_active' => $validated['is_active'] ?? $brand->is_active,
        ];

        if ($request->hasFile('image')) {
            if ($brand->image_path) {
                Storage::disk('public')->delete($brand->image_path);
            }
            $updateData['image_path'] = $request->file('image')->store('brands', 'public');
        }

        $brand->update($updateData);

        return response()->json([
            'message' => 'Brand updated successfully.',
            'brand' => $brand->fresh(),
        ]);
    }

    public function destroy(Brand $brand)
    {
        if ($brand->image_path) {
            Storage::disk('public')->delete($brand->image_path);
        }
        $brand->delete();

        return response()->json([
            'message' => 'Brand deleted successfully.',
        ]);
    }
}
