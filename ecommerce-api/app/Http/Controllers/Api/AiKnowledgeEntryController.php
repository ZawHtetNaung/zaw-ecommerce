<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiKnowledgeEntry;
use Illuminate\Http\Request;

class AiKnowledgeEntryController extends Controller
{
    public function index()
    {
        return response()->json(
            AiKnowledgeEntry::query()->orderBy('sort_order')->orderBy('title')->get()
        );
    }

    public function store(Request $request)
    {
        $entry = AiKnowledgeEntry::query()->create($this->validated($request));

        return response()->json([
            'message' => 'AI knowledge entry created successfully.',
            'entry' => $entry,
        ], 201);
    }

    public function show(AiKnowledgeEntry $aiKnowledge)
    {
        return response()->json($aiKnowledge);
    }

    public function update(Request $request, AiKnowledgeEntry $aiKnowledge)
    {
        $aiKnowledge->update($this->validated($request));

        return response()->json([
            'message' => 'AI knowledge entry updated successfully.',
            'entry' => $aiKnowledge->fresh(),
        ]);
    }

    public function destroy(AiKnowledgeEntry $aiKnowledge)
    {
        $aiKnowledge->delete();

        return response()->json([
            'message' => 'AI knowledge entry deleted successfully.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request): array
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'topic' => ['required', 'string', 'max:60'],
            'content' => ['required', 'string', 'max:10000'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:65535'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $validated['sort_order'] = $validated['sort_order'] ?? 0;
        $validated['is_active'] = $validated['is_active'] ?? true;

        return $validated;
    }
}
