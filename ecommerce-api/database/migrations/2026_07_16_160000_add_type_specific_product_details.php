<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->string('product_type', 30)->default('furniture')->after('sku');
            $table->string('selling_method', 30)->default('per_item')->after('product_type');
            $table->decimal('physical_length', 12, 3)->nullable()->after('selling_method');
            $table->decimal('physical_width', 12, 3)->nullable()->after('physical_length');
            $table->decimal('physical_height', 12, 3)->nullable()->after('physical_width');
            $table->decimal('physical_weight', 12, 3)->nullable()->after('physical_height');
            $table->string('dimension_unit', 10)->default('cm')->after('physical_weight');
            $table->string('weight_unit', 10)->default('kg')->after('dimension_unit');
        });

        Schema::create('product_flooring_details', function (Blueprint $table): void {
            $table->id(); $table->foreignId('product_id')->unique()->constrained()->cascadeOnDelete();
            $table->decimal('piece_length', 12, 3)->nullable(); $table->decimal('piece_width', 12, 3)->nullable();
            $table->decimal('thickness', 12, 3)->nullable(); $table->decimal('coverage_per_box', 12, 3)->nullable();
            $table->unsignedInteger('pieces_per_box')->nullable(); $table->decimal('minimum_order', 12, 3)->nullable();
            $table->decimal('waste_percentage', 5, 2)->default(10); $table->timestamps();
        });

        Schema::create('product_wallpaper_details', function (Blueprint $table): void {
            $table->id(); $table->foreignId('product_id')->unique()->constrained()->cascadeOnDelete();
            $table->decimal('roll_width', 12, 3)->nullable(); $table->decimal('roll_length', 12, 3)->nullable();
            $table->decimal('coverage_per_roll', 12, 3)->nullable(); $table->decimal('pattern_repeat', 12, 3)->nullable();
            $table->string('match_type', 50)->nullable(); $table->timestamps();
        });

        $flooringCategories = DB::table('categories')->whereRaw('LOWER(name) LIKE ?', ['%floor%'])->pluck('id');
        $wallpaperCategories = DB::table('categories')->whereRaw('LOWER(name) LIKE ?', ['%wallpaper%'])->pluck('id');
        DB::table('products')->whereIn('category_id', $flooringCategories)->update(['product_type' => 'flooring', 'selling_method' => 'per_square_meter']);
        DB::table('products')->whereIn('category_id', $wallpaperCategories)->update(['product_type' => 'wallpaper', 'selling_method' => 'per_roll']);
    }

    public function down(): void
    {
        Schema::dropIfExists('product_wallpaper_details'); Schema::dropIfExists('product_flooring_details');
        Schema::table('products', fn (Blueprint $table) => $table->dropColumn(['product_type','selling_method','physical_length','physical_width','physical_height','physical_weight','dimension_unit','weight_unit']));
    }
};
