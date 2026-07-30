<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminAccountController extends Controller
{
    public function index()
    {
        return response()->json(
            User::query()
                ->whereIn('role', ['admin', 'super_admin'])
                ->select([
                    'id',
                    'name',
                    'email',
                    'phone',
                    'job_title',
                    'access_reason',
                    'role',
                    'admin_status',
                    'approved_at',
                    'approved_by',
                    'created_at',
                ])
                ->latest()
                ->get()
        );
    }

    public function updateStatus(Request $request, User $user)
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(['approved', 'rejected', 'suspended'])],
        ]);

        if (! $user->isAdmin()) {
            throw ValidationException::withMessages([
                'status' => ['Only administrator accounts can be reviewed here.'],
            ]);
        }

        if ($user->isSuperAdmin()) {
            throw ValidationException::withMessages([
                'status' => ['The super-administrator account cannot be changed from this screen.'],
            ]);
        }

        $user->update([
            'admin_status' => $validated['status'],
            'approved_at' => $validated['status'] === 'approved' ? now() : null,
            'approved_by' => $request->user()->id,
        ]);

        if ($validated['status'] !== 'approved') {
            $user->tokens()->delete();
        }

        return response()->json([
            'message' => "Administrator account marked as {$validated['status']}.",
            'user' => $user->fresh(),
        ]);
    }
}
