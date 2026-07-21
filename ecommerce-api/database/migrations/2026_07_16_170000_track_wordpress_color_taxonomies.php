<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('colors', function (Blueprint $table): void {
            $table->dropUnique('colors_name_unique');
            $table->unsignedBigInteger('wordpress_term_id')->nullable()->after('id');
            $table->string('source_taxonomy', 100)->nullable()->after('wordpress_term_id');
            $table->unique(['wordpress_term_id', 'source_taxonomy'], 'colors_wordpress_taxonomy_unique');
            $table->index('name');
        });
    }
    public function down(): void
    {
        Schema::table('colors', function (Blueprint $table): void {
            $table->dropUnique('colors_wordpress_taxonomy_unique'); $table->dropIndex(['name']);
            $table->dropColumn(['wordpress_term_id', 'source_taxonomy']); $table->unique('name');
        });
    }
};
