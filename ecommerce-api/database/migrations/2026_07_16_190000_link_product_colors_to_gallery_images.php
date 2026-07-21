<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('color_product', function (Blueprint $table) {
            $table->foreignId('product_image_id')->nullable()->after('color_id')->constrained('product_images')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('color_product', function (Blueprint $table) {
            $table->dropConstrainedForeignId('product_image_id');
        });
    }
};
