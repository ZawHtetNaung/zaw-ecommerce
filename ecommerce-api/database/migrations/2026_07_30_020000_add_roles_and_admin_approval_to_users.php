<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('role', 30)->default('customer')->after('email')->index();
            $table->string('admin_status', 30)->default('approved')->after('role')->index();
            $table->string('phone', 30)->nullable()->after('admin_status');
            $table->string('job_title', 100)->nullable()->after('phone');
            $table->text('access_reason')->nullable()->after('job_title');
            $table->timestamp('approved_at')->nullable()->after('access_reason');
            $table->unsignedBigInteger('approved_by')->nullable()->after('approved_at')->index();
        });

        DB::table('users')->update([
            'role' => 'customer',
            'admin_status' => 'approved',
        ]);

        $oldestUserId = DB::table('users')->orderBy('id')->value('id');

        if ($oldestUserId !== null) {
            DB::table('users')
                ->where('id', $oldestUserId)
                ->update([
                    'role' => 'super_admin',
                    'admin_status' => 'approved',
                    'approved_at' => now(),
                    'approved_by' => $oldestUserId,
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn([
                'role',
                'admin_status',
                'phone',
                'job_title',
                'access_reason',
                'approved_at',
                'approved_by',
            ]);
        });
    }
};
