<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('brands', function (Blueprint $table) {
            $table->unsignedBigInteger('wordpress_id')->nullable()->unique()->after('id');
            $table->string('source_url')->nullable()->after('image_path');
        });
    }

    public function down(): void
    {
        Schema::table('brands', fn (Blueprint $table) => $table->dropColumn(['wordpress_id', 'source_url']));
    }
};
