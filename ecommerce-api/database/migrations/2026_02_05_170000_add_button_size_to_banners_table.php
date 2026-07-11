<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('banners', function (Blueprint $table) {
            $table->unsignedInteger('button_width')->default(140)->after('button_text_color');
            $table->unsignedInteger('button_height')->default(40)->after('button_width');
        });
    }

    public function down(): void
    {
        Schema::table('banners', function (Blueprint $table) {
            $table->dropColumn(['button_width', 'button_height']);
        });
    }
};
