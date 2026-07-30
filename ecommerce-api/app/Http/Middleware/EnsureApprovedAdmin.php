<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureApprovedAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user?->isAdmin()) {
            return response()->json([
                'message' => 'An approved administrator account is required.',
            ], 403);
        }

        if ($user->admin_status !== 'approved') {
            return response()->json([
                'message' => 'Your administrator account is not approved.',
                'admin_status' => $user->admin_status,
            ], 403);
        }

        return $next($request);
    }
}
