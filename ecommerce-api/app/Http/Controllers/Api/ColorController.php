<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Color;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ColorController extends Controller
{
    public function index()
    {
        return response()->json(
            Color::query()->latest()->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'hex_code' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'image' => ['nullable', 'image', 'max:2048'],
            'image_alt_text' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $validated['is_active'] = $validated['is_active'] ?? true;
        $validated['hex_code'] = isset($validated['hex_code']) ? strtoupper($validated['hex_code']) : null;
        if ($request->hasFile('image')) {
            $validated['image_path'] = $request->file('image')->store('colors', 'public');
        }

        $color = Color::create($validated);

        return response()->json([
            'message' => 'Color created successfully.',
            'color' => $color,
        ], 201);
    }

    public function show(Color $color)
    {
        return response()->json($color);
    }

    public function update(Request $request, Color $color)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'hex_code' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'image' => ['nullable', 'image', 'max:2048'],
            'image_alt_text' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $updateData = [
            'name' => $validated['name'],
            'hex_code' => isset($validated['hex_code']) ? strtoupper($validated['hex_code']) : null,
            'image_alt_text' => $validated['image_alt_text'] ?? null,
            'is_active' => $validated['is_active'] ?? $color->is_active,
        ];

        if ($request->hasFile('image')) {
            if ($color->image_path) {
                Storage::disk('public')->delete($color->image_path);
            }
            $updateData['image_path'] = $request->file('image')->store('colors', 'public');
        }

        $color->update($updateData);

        return response()->json([
            'message' => 'Color updated successfully.',
            'color' => $color->fresh(),
        ]);
    }

    public function destroy(Color $color)
    {
        if ($color->image_path) {
            Storage::disk('public')->delete($color->image_path);
        }
        $color->delete();

        return response()->json([
            'message' => 'Color deleted successfully.',
        ]);
    }
}
