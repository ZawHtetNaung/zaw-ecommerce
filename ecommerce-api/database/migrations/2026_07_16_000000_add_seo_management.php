<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_images', function (Blueprint $table): void {
            $table->string('alt_text')->nullable()->after('path');
        });
        foreach (['categories', 'sub_categories', 'brands', 'colors', 'banners'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table): void {
                $table->string('image_alt_text')->nullable()->after('image_path');
            });
        }

        Schema::create('seo_pages', function (Blueprint $table): void {
            $table->id();
            $table->string('page_key')->unique();
            $table->string('name');
            $table->string('path')->unique();
            $table->string('meta_title')->nullable();
            $table->text('meta_description')->nullable();
            $table->boolean('is_indexable')->default(true);
            $table->timestamps();
        });

        Schema::create('seo_settings', function (Blueprint $table): void {
            $table->id();
            $table->string('key')->unique();
            $table->longText('value')->nullable();
            $table->timestamps();
        });

        $now = now();
        DB::table('seo_pages')->insert([
            ['page_key' => 'home', 'name' => 'Home', 'path' => '/', 'meta_title' => 'Messara Living', 'meta_description' => null, 'is_indexable' => true, 'created_at' => $now, 'updated_at' => $now],
            ['page_key' => 'search', 'name' => 'Search', 'path' => '/search', 'meta_title' => 'Search Products | Messara Living', 'meta_description' => null, 'is_indexable' => true, 'created_at' => $now, 'updated_at' => $now],
            ['page_key' => 'services', 'name' => 'Services', 'path' => '/services', 'meta_title' => 'Services | Messara Living', 'meta_description' => null, 'is_indexable' => true, 'created_at' => $now, 'updated_at' => $now],
            ['page_key' => 'news', 'name' => 'News', 'path' => '/news', 'meta_title' => 'News | Messara Living', 'meta_description' => null, 'is_indexable' => true, 'created_at' => $now, 'updated_at' => $now],
            ['page_key' => 'login', 'name' => 'Login', 'path' => '/login', 'meta_title' => 'Login | Messara Living', 'meta_description' => null, 'is_indexable' => false, 'created_at' => $now, 'updated_at' => $now],
            ['page_key' => 'register', 'name' => 'Register', 'path' => '/register', 'meta_title' => 'Create Account | Messara Living', 'meta_description' => null, 'is_indexable' => false, 'created_at' => $now, 'updated_at' => $now],
            ['page_key' => 'forgot_password', 'name' => 'Forgot Password', 'path' => '/forgot-password', 'meta_title' => 'Forgot Password | Messara Living', 'meta_description' => null, 'is_indexable' => false, 'created_at' => $now, 'updated_at' => $now],
            ['page_key' => 'cart', 'name' => 'Cart', 'path' => '/cart', 'meta_title' => 'Cart | Messara Living', 'meta_description' => null, 'is_indexable' => false, 'created_at' => $now, 'updated_at' => $now],
            ['page_key' => 'favourites', 'name' => 'Favourites', 'path' => '/favourites', 'meta_title' => 'Favourites | Messara Living', 'meta_description' => null, 'is_indexable' => false, 'created_at' => $now, 'updated_at' => $now],
            ['page_key' => 'profile', 'name' => 'Profile', 'path' => '/profile', 'meta_title' => 'Profile | Messara Living', 'meta_description' => null, 'is_indexable' => false, 'created_at' => $now, 'updated_at' => $now],
        ]);

        DB::table('seo_settings')->insert([
            'key' => 'robots_txt',
            'value' => "User-agent: *\nAllow: /\nDisallow: /dashboard",
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('seo_settings');
        Schema::dropIfExists('seo_pages');
        Schema::table('product_images', function (Blueprint $table): void {
            $table->dropColumn('alt_text');
        });
        foreach (['categories', 'sub_categories', 'brands', 'colors', 'banners'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table): void {
                $table->dropColumn('image_alt_text');
            });
        }
    }
};
