<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('banners', function (Blueprint $table) {
            $table->string('button_style')->default('solid')->after('button_pos_y');
            $table->unsignedInteger('button_radius')->default(24)->after('button_style');
            $table->string('button_bg_color')->default('#e2211c')->after('button_radius');
            $table->string('button_text_color')->default('#ffffff')->after('button_bg_color');
        });
    }

    public function down(): void
    {
        Schema::table('banners', function (Blueprint $table) {
            $table->dropColumn(['button_style', 'button_radius', 'button_bg_color', 'button_text_color']);
        });
    }
};
