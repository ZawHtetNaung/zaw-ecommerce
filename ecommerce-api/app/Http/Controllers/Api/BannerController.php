<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Banner;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class BannerController extends Controller
{
    public function index()
    {
        return response()->json(
            Banner::query()
                ->orderBy('sort_order')
                ->latest()
                ->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'button_text' => ['nullable', 'string', 'max:255'],
            'button_link' => ['nullable', 'string', 'max:255'],
            'button_pos_x' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'button_pos_y' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'button_style' => ['nullable', 'string', Rule::in(['solid', 'outline', 'ghost'])],
            'button_radius' => ['nullable', 'integer', 'min:0', 'max:200'],
            'button_bg_color' => ['nullable', 'string', 'max:20'],
            'button_text_color' => ['nullable', 'string', 'max:20'],
            'button_width' => ['nullable', 'integer', 'min:40', 'max:400'],
            'button_height' => ['nullable', 'integer', 'min:24', 'max:160'],
            'button_text_size' => ['nullable', 'integer', 'min:10', 'max:64'],
            'image' => ['nullable', 'image', 'max:4096'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $validated['is_active'] = $validated['is_active'] ?? true;
        $validated['sort_order'] = (int) (Banner::max('sort_order') ?? -1) + 1;
        $validated['button_pos_x'] = isset($validated['button_pos_x']) ? (float) $validated['button_pos_x'] : 50;
        $validated['button_pos_y'] = isset($validated['button_pos_y']) ? (float) $validated['button_pos_y'] : 80;
        $validated['button_style'] = $validated['button_style'] ?? 'solid';
        $validated['button_radius'] = isset($validated['button_radius']) ? (int) $validated['button_radius'] : 24;
        $validated['button_bg_color'] = $validated['button_bg_color'] ?? '#e2211c';
        $validated['button_text_color'] = $validated['button_text_color'] ?? '#ffffff';
        $validated['button_width'] = isset($validated['button_width']) ? (int) $validated['button_width'] : 140;
        $validated['button_height'] = isset($validated['button_height']) ? (int) $validated['button_height'] : 40;
        $validated['button_text_size'] = isset($validated['button_text_size']) ? (int) $validated['button_text_size'] : 14;

        if ($request->hasFile('image')) {
            $validated['image_path'] = $request->file('image')->store('banners', 'public');
        }

        $banner = Banner::create($validated);

        return response()->json([
            'message' => 'Banner created successfully.',
            'banner' => $banner,
        ], 201);
    }

    public function show(Banner $banner)
    {
        return response()->json($banner);
    }

    public function update(Request $request, Banner $banner)
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'button_text' => ['nullable', 'string', 'max:255'],
            'button_link' => ['nullable', 'string', 'max:255'],
            'button_pos_x' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'button_pos_y' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'button_style' => ['nullable', 'string', Rule::in(['solid', 'outline', 'ghost'])],
            'button_radius' => ['nullable', 'integer', 'min:0', 'max:200'],
            'button_bg_color' => ['nullable', 'string', 'max:20'],
            'button_text_color' => ['nullable', 'string', 'max:20'],
            'button_width' => ['nullable', 'integer', 'min:40', 'max:400'],
            'button_height' => ['nullable', 'integer', 'min:24', 'max:160'],
            'button_text_size' => ['nullable', 'integer', 'min:10', 'max:64'],
            'image' => ['nullable', 'image', 'max:4096'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $updateData = [
            'title' => $validated['title'],
            'subtitle' => $validated['subtitle'] ?? null,
            'button_text' => $validated['button_text'] ?? null,
            'button_link' => $validated['button_link'] ?? null,
            'button_pos_x' => isset($validated['button_pos_x']) ? (float) $validated['button_pos_x'] : $banner->button_pos_x,
            'button_pos_y' => isset($validated['button_pos_y']) ? (float) $validated['button_pos_y'] : $banner->button_pos_y,
            'button_style' => $validated['button_style'] ?? $banner->button_style ?? 'solid',
            'button_radius' => isset($validated['button_radius']) ? (int) $validated['button_radius'] : ($banner->button_radius ?? 24),
            'button_bg_color' => $validated['button_bg_color'] ?? $banner->button_bg_color ?? '#e2211c',
            'button_text_color' => $validated['button_text_color'] ?? $banner->button_text_color ?? '#ffffff',
            'button_width' => isset($validated['button_width']) ? (int) $validated['button_width'] : ($banner->button_width ?? 140),
            'button_height' => isset($validated['button_height']) ? (int) $validated['button_height'] : ($banner->button_height ?? 40),
            'button_text_size' => isset($validated['button_text_size']) ? (int) $validated['button_text_size'] : ($banner->button_text_size ?? 14),
            'is_active' => $validated['is_active'] ?? $banner->is_active,
            'sort_order' => $validated['sort_order'] ?? $banner->sort_order,
        ];

        if ($request->hasFile('image')) {
            if ($banner->image_path) {
                Storage::disk('public')->delete($banner->image_path);
            }
            $updateData['image_path'] = $request->file('image')->store('banners', 'public');
        }

        $banner->update($updateData);

        return response()->json([
            'message' => 'Banner updated successfully.',
            'banner' => $banner->fresh(),
        ]);
    }

    public function destroy(Banner $banner)
    {
        if ($banner->image_path) {
            Storage::disk('public')->delete($banner->image_path);
        }

        $banner->delete();

        return response()->json([
            'message' => 'Banner deleted successfully.',
        ]);
    }

    public function reorder(Request $request)
    {
        $validated = $request->validate([
            'items' => ['required', 'array'],
            'items.*' => ['integer', Rule::exists('banners', 'id')],
        ]);

        foreach ($validated['items'] as $index => $id) {
            Banner::where('id', $id)->update(['sort_order' => $index]);
        }

        return response()->json([
            'message' => 'Banner order updated successfully.',
        ]);
    }
}
