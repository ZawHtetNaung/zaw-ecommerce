<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiChatMessage;
use App\Models\AiChatSession;
use App\Services\AiBusinessAssistantService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AiChatController extends Controller
{
    public function respond(Request $request, AiBusinessAssistantService $assistant)
    {
        $validated = $request->validate([
            'message' => ['required', 'string', 'min:2', 'max:1200'],
            'session_id' => ['nullable', 'uuid'],
            'locale' => ['nullable', 'string', 'max:12'],
            'page_url' => ['nullable', 'string', 'max:2048'],
            'history' => ['nullable', 'array', 'max:12'],
            'history.*.role' => ['required_with:history', 'in:user,assistant'],
            'history.*.content' => ['required_with:history', 'string', 'max:1200'],
        ]);

        $sessionUuid = $validated['session_id'] ?? (string) Str::uuid();
        $session = AiChatSession::query()->firstOrCreate(
            ['uuid' => $sessionUuid],
            [
                'user_id' => $request->user('sanctum')?->id,
                'locale' => $validated['locale'] ?? 'en',
                'page_url' => $validated['page_url'] ?? null,
                'last_message_at' => now(),
            ]
        );

        $session->update([
            'user_id' => $session->user_id ?: $request->user('sanctum')?->id,
            'locale' => $validated['locale'] ?? $session->locale,
            'page_url' => $validated['page_url'] ?? $session->page_url,
            'last_message_at' => now(),
        ]);

        $conversationHistory = $session->messages()
            ->latest('id')
            ->limit(10)
            ->get()
            ->reverse()
            ->map(fn (AiChatMessage $chatMessage): array => [
                'role' => $chatMessage->role,
                'content' => $chatMessage->content,
            ])
            ->values()
            ->all();

        AiChatMessage::query()->create([
            'ai_chat_session_id' => $session->id,
            'role' => 'user',
            'content' => trim($validated['message']),
        ]);

        $result = $assistant->respond(
            trim($validated['message']),
            $conversationHistory,
            $validated['page_url'] ?? null,
            $session->uuid
        );

        AiChatMessage::query()->create([
            'ai_chat_session_id' => $session->id,
            'role' => 'assistant',
            'content' => $result['answer'],
            'metadata' => [
                'products' => collect($result['products'])->pluck('id')->all(),
                'handoff' => $result['handoff'],
                'provider_status' => $result['provider_status'],
            ],
        ]);

        $session->update([
            'handed_off' => $session->handed_off || $result['handoff'],
            'last_message_at' => now(),
        ]);

        return response()->json([
            'session_id' => $session->uuid,
            ...$result,
        ]);
    }
}
