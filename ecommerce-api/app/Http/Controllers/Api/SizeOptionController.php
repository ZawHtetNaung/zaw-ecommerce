<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SizeOption;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SizeOptionController extends Controller
{
    public function index()
    {
        return response()->json(SizeOption::orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $validated = $request->validate(['name' => ['required', 'string', 'max:255', 'unique:size_options,name']]);
        $slug = Str::slug($validated['name']);
        if (SizeOption::where('slug', $slug)->exists()) $slug .= '-'.Str::lower(Str::random(5));
        $sizeOption = SizeOption::create(['name' => trim($validated['name']), 'slug' => $slug]);
        return response()->json(['message' => 'Size option created successfully.', 'size_option' => $sizeOption], 201);
    }

    public function show(SizeOption $sizeOption)
    {
        return response()->json($sizeOption);
    }

    public function update(Request $request, SizeOption $sizeOption)
    {
        $validated = $request->validate(['name' => ['required', 'string', 'max:255', Rule::unique('size_options', 'name')->ignore($sizeOption->id)]]);
        $slug = Str::slug($validated['name']);
        if (SizeOption::where('slug', $slug)->whereKeyNot($sizeOption->id)->exists()) $slug .= '-'.Str::lower(Str::random(5));
        $sizeOption->update(['name' => trim($validated['name']), 'slug' => $slug]);
        return response()->json(['message' => 'Size option updated successfully.', 'size_option' => $sizeOption]);
    }

    public function destroy(SizeOption $sizeOption)
    {
        $sizeOption->delete();
        return response()->json(['message' => 'Size option deleted successfully.']);
    }
}
