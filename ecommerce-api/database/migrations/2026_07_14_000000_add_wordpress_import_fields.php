<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->unsignedBigInteger('wordpress_id')->nullable()->unique()->after('id');
            $table->string('seo_title')->nullable()->after('description');
            $table->text('seo_description')->nullable()->after('seo_title');
            $table->string('source_url')->nullable()->after('seo_description');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->unsignedBigInteger('wordpress_id')->nullable()->unique()->after('id');
            $table->string('sku')->nullable()->index()->after('slug');
            $table->text('short_description')->nullable()->after('description');
            $table->string('seo_title')->nullable()->after('short_description');
            $table->text('seo_description')->nullable()->after('seo_title');
            $table->string('source_url')->nullable()->after('seo_description');
        });

        Schema::table('banners', function (Blueprint $table) {
            $table->unsignedBigInteger('wordpress_id')->nullable()->unique()->after('id');
            $table->string('source_url')->nullable()->after('button_link');
        });
    }

    public function down(): void
    {
        Schema::table('banners', fn (Blueprint $table) => $table->dropColumn(['wordpress_id', 'source_url']));
        Schema::table('products', fn (Blueprint $table) => $table->dropColumn([
            'wordpress_id', 'sku', 'short_description', 'seo_title', 'seo_description', 'source_url',
        ]));
        Schema::table('categories', fn (Blueprint $table) => $table->dropColumn([
            'wordpress_id', 'seo_title', 'seo_description', 'source_url',
        ]));
    }
};
