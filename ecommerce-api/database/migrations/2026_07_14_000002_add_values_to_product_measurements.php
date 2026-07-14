<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('measurement_product', function (Blueprint $table) {
            $table->decimal('value', 12, 3)->nullable();
            $table->string('unit', 20)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('measurement_product', fn (Blueprint $table) => $table->dropColumn(['value', 'unit']));
    }
};
