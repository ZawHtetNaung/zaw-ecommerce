<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Measurement;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MeasurementController extends Controller
{
    public function index()
    {
        return response()->json(
            Measurement::query()->latest()->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:measurements,name'],
            'value' => ['nullable', 'string', 'max:50'],
            'unit' => ['required', 'string', 'max:20'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $validated['is_active'] = $validated['is_active'] ?? true;
        $measurement = Measurement::create($validated);

        return response()->json([
            'message' => 'Measurement created successfully.',
            'measurement' => $measurement,
        ], 201);
    }

    public function show(Measurement $measurement)
    {
        return response()->json($measurement);
    }

    public function update(Request $request, Measurement $measurement)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('measurements', 'name')->ignore($measurement->id)],
            'value' => ['nullable', 'string', 'max:50'],
            'unit' => ['required', 'string', 'max:20'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $measurement->update([
            'name' => $validated['name'],
            'value' => $validated['value'] ?? null,
            'unit' => $validated['unit'],
            'is_active' => $validated['is_active'] ?? $measurement->is_active,
        ]);

        return response()->json([
            'message' => 'Measurement updated successfully.',
            'measurement' => $measurement->fresh(),
        ]);
    }

    public function destroy(Measurement $measurement)
    {
        $measurement->delete();

        return response()->json([
            'message' => 'Measurement deleted successfully.',
        ]);
    }
}
