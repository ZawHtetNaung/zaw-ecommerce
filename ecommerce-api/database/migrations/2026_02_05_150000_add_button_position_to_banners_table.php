<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('banners', function (Blueprint $table) {
            $table->float('button_pos_x')->default(50)->after('button_link');
            $table->float('button_pos_y')->default(80)->after('button_pos_x');
        });
    }

    public function down(): void
    {
        Schema::table('banners', function (Blueprint $table) {
            $table->dropColumn(['button_pos_x', 'button_pos_y']);
        });
    }
};
