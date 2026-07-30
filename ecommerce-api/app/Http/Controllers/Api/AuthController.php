<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function customerRegister(Request $request)
    {
        $this->normalizeIdentityFields($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:100', "regex:/^[\pL\pM][\pL\pM\s.'-]{1,99}$/u"],
            'email' => ['required', 'string', 'email:rfc', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:30', 'regex:/^\+?[0-9\s\-()]{7,20}$/'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)->letters()->numbers()],
            'terms_accepted' => ['required', 'accepted'],
        ], $this->validationMessages());

        $user = User::query()->create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'password' => $validated['password'],
            'role' => 'customer',
            'admin_status' => 'approved',
        ]);
        $token = $user->createToken('customer_auth_token', ['customer'])->plainTextToken;

        return response()->json([
            'message' => 'Customer account created successfully.',
            'user' => $user,
            'token' => $token,
        ], 201);
    }

    public function customerLogin(Request $request)
    {
        $validated = $this->validateLogin($request);
        $user = $this->findUserWithValidPassword($validated);

        if ($user->role !== 'customer') {
            throw ValidationException::withMessages([
                'email' => ['This is an administrator account. Please use the administrator sign-in page.'],
            ]);
        }

        $token = $user->createToken('customer_auth_token', ['customer'])->plainTextToken;

        return response()->json([
            'message' => 'Customer login successful.',
            'user' => $user,
            'token' => $token,
        ]);
    }

    public function adminRegister(Request $request)
    {
        $this->normalizeIdentityFields($request);

        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:100', "regex:/^[\pL\pM][\pL\pM\s.'-]{1,99}$/u"],
            'email' => ['required', 'string', 'email:rfc', 'max:255', 'unique:users,email'],
            'phone' => ['required', 'string', 'max:30', 'regex:/^\+?[0-9\s\-()]{7,20}$/'],
            'job_title' => ['required', 'string', 'min:2', 'max:100'],
            'access_reason' => ['required', 'string', 'min:10', 'max:1000'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)->letters()->numbers()],
            'terms_accepted' => ['required', 'accepted'],
        ], $this->validationMessages());

        $user = User::query()->create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'],
            'job_title' => trim($validated['job_title']),
            'access_reason' => trim($validated['access_reason']),
            'password' => $validated['password'],
            'role' => 'admin',
            'admin_status' => 'pending',
        ]);

        return response()->json([
            'message' => 'Administrator request submitted. A super administrator must approve it before you can sign in.',
            'admin_status' => $user->admin_status,
            'user' => $user,
        ], 202);
    }

    public function adminLogin(Request $request)
    {
        $validated = $this->validateLogin($request);
        $user = $this->findUserWithValidPassword($validated);

        if (! $user->isAdmin()) {
            throw ValidationException::withMessages([
                'email' => ['This is a customer account. Please use the customer sign-in page.'],
            ]);
        }

        if ($user->admin_status !== 'approved') {
            $message = match ($user->admin_status) {
                'pending' => 'Your administrator request is waiting for super-admin approval.',
                'rejected' => 'Your administrator request was rejected. Contact the super administrator.',
                'suspended' => 'Your administrator access is suspended. Contact the super administrator.',
                default => 'Your administrator account cannot sign in.',
            };

            return response()->json([
                'message' => $message,
                'admin_status' => $user->admin_status,
            ], 403);
        }

        $abilities = $user->isSuperAdmin()
            ? ['admin', 'super_admin']
            : ['admin'];
        $token = $user->createToken('admin_auth_token', $abilities)->plainTextToken;

        return response()->json([
            'message' => 'Administrator login successful.',
            'user' => $user,
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    public function forgotPassword(Request $request)
    {
        $request->merge(['email' => Str::lower(trim((string) $request->input('email')))]);
        $validated = $request->validate([
            'email' => ['required', 'email:rfc', 'max:255'],
        ]);

        $status = Password::sendResetLink([
            'email' => $validated['email'],
        ]);

        if ($status === Password::RESET_LINK_SENT) {
            return response()->json([
                'message' => __($status),
            ]);
        }

        throw ValidationException::withMessages([
            'email' => [__($status)],
        ]);
    }

    public function resetPassword(Request $request)
    {
        $request->merge(['email' => Str::lower(trim((string) $request->input('email')))]);
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email:rfc', 'max:255'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)->letters()->numbers()],
        ], $this->validationMessages());

        $status = Password::reset(
            $validated,
            function (User $user, string $password): void {
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                ])->save();

                $user->tokens()->delete();
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json([
                'message' => __($status),
            ]);
        }

        throw ValidationException::withMessages([
            'email' => [__($status)],
        ]);
    }

    /**
     * @return array{email: string, password: string}
     */
    private function validateLogin(Request $request): array
    {
        $request->merge(['email' => Str::lower(trim((string) $request->input('email')))]);

        return $request->validate([
            'email' => ['required', 'email:rfc', 'max:255'],
            'password' => ['required', 'string', 'min:8', 'max:255'],
        ], $this->validationMessages());
    }

    /**
     * @param  array{email: string, password: string}  $credentials
     */
    private function findUserWithValidPassword(array $credentials): User
    {
        $user = User::query()->where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        return $user;
    }

    private function normalizeIdentityFields(Request $request): void
    {
        $request->merge([
            'name' => trim((string) $request->input('name')),
            'email' => Str::lower(trim((string) $request->input('email'))),
            'phone' => trim((string) $request->input('phone')) ?: null,
        ]);
    }

    /**
     * @return array<string, string>
     */
    private function validationMessages(): array
    {
        return [
            'name.regex' => 'The name may contain letters, spaces, apostrophes, periods, and hyphens only.',
            'phone.regex' => 'Enter a valid telephone number.',
            'password.min' => 'The password must contain at least 8 characters.',
            'password.letters' => 'The password must contain at least one letter.',
            'password.numbers' => 'The password must contain at least one number.',
            'terms_accepted.accepted' => 'You must accept the terms and privacy policy.',
        ];
    }
}
