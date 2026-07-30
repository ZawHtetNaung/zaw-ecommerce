<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_registration_creates_an_approved_customer_and_returns_a_customer_token(): void
    {
        $response = $this->postJson('/api/customer/register', [
            'name' => 'Jane Doe',
            'email' => 'JANE@example.com',
            'phone' => '+971 50 123 4567',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'terms_accepted' => true,
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('user.email', 'jane@example.com')
            ->assertJsonPath('user.role', 'customer')
            ->assertJsonPath('user.admin_status', 'approved')
            ->assertJsonStructure(['message', 'token', 'user']);

        $this->assertDatabaseHas('users', [
            'email' => 'jane@example.com',
            'role' => 'customer',
            'admin_status' => 'approved',
        ]);
    }

    public function test_customer_registration_validates_every_field_and_password_rules(): void
    {
        $this->postJson('/api/customer/register', [
            'name' => '1',
            'email' => 'not-an-email',
            'phone' => 'abc',
            'password' => 'short',
            'password_confirmation' => 'different',
            'terms_accepted' => false,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'name',
                'email',
                'phone',
                'password',
                'terms_accepted',
            ]);
    }

    public function test_admin_registration_is_pending_and_cannot_login_before_super_admin_approval(): void
    {
        $response = $this->postJson('/api/admin/register', $this->adminRegistrationPayload());

        $response
            ->assertStatus(202)
            ->assertJsonMissingPath('token')
            ->assertJsonPath('user.role', 'admin')
            ->assertJsonPath('admin_status', 'pending');

        $this->postJson('/api/admin/login', [
            'email' => 'manager@example.com',
            'password' => 'Adminpass123',
        ])
            ->assertForbidden()
            ->assertJsonPath('admin_status', 'pending');
    }

    public function test_super_admin_can_approve_admin_then_approved_admin_can_login_and_use_dashboard(): void
    {
        $superAdmin = User::factory()->superAdmin()->create();
        $superToken = $superAdmin->createToken('super-admin-test')->plainTextToken;

        $this->postJson('/api/admin/register', $this->adminRegistrationPayload())
            ->assertStatus(202);
        $pendingAdmin = User::query()->where('email', 'manager@example.com')->firstOrFail();

        $this->withToken($superToken)
            ->patchJson("/api/admin-accounts/{$pendingAdmin->id}/status", [
                'status' => 'approved',
            ])
            ->assertOk()
            ->assertJsonPath('user.admin_status', 'approved');

        $login = $this->postJson('/api/admin/login', [
            'email' => 'manager@example.com',
            'password' => 'Adminpass123',
        ]);

        $login
            ->assertOk()
            ->assertJsonPath('user.role', 'admin')
            ->assertJsonPath('user.admin_status', 'approved');

        $this->withToken($login->json('token'))
            ->getJson('/api/users')
            ->assertOk();
    }

    public function test_customer_cannot_access_dashboard_apis_and_regular_admin_cannot_approve_accounts(): void
    {
        $customer = User::factory()->create();
        $customerToken = $customer->createToken('customer-test')->plainTextToken;
        $admin = User::factory()->admin()->create();
        $adminToken = $admin->createToken('admin-test')->plainTextToken;
        $pending = User::factory()->admin('pending')->create();

        $this->withToken($customerToken)
            ->getJson('/api/users')
            ->assertForbidden();

        $this->withToken($adminToken)
            ->patchJson("/api/admin-accounts/{$pending->id}/status", [
                'status' => 'approved',
            ])
            ->assertForbidden();
    }

    public function test_customer_and_admin_must_use_their_separate_login_forms(): void
    {
        $customer = User::factory()->create([
            'password' => Hash::make('password123'),
        ]);
        $admin = User::factory()->admin()->create([
            'password' => Hash::make('Adminpass123'),
        ]);

        $this->postJson('/api/admin/login', [
            'email' => $customer->email,
            'password' => 'password123',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');

        $this->postJson('/api/customer/login', [
            'email' => $admin->email,
            'password' => 'Adminpass123',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_user_can_reset_password(): void
    {
        $user = User::factory()->create([
            'email' => 'reset@example.com',
            'password' => Hash::make('password123'),
        ]);

        $token = Password::broker()->createToken($user);

        $response = $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => $user->email,
            'password' => 'new-password123',
            'password_confirmation' => 'new-password123',
        ]);

        $response->assertOk();

        $this->assertTrue(Hash::check('new-password123', $user->fresh()->password));
    }

    /**
     * @return array<string, mixed>
     */
    private function adminRegistrationPayload(): array
    {
        return [
            'name' => 'Store Manager',
            'email' => 'manager@example.com',
            'phone' => '+971 50 123 4567',
            'job_title' => 'Ecommerce Manager',
            'access_reason' => 'I manage products, catalogue content, and customer quotations.',
            'password' => 'Adminpass123',
            'password_confirmation' => 'Adminpass123',
            'terms_accepted' => true,
        ];
    }
}
