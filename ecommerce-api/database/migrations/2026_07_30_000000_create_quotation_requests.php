<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quotation_requests', function (Blueprint $table): void {
            $table->id();
            $table->string('reference')->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('customer_name');
            $table->string('email');
            $table->string('phone', 50);
            $table->string('company')->nullable();
            $table->string('project_type', 50)->nullable();
            $table->string('emirate', 100)->nullable();
            $table->date('required_by')->nullable();
            $table->text('message')->nullable();
            $table->string('status', 30)->default('new')->index();
            $table->text('staff_note')->nullable();
            $table->decimal('total_amount', 12, 2)->default(0);
            $table->string('currency', 3)->default('AED');
            $table->timestamps();
        });

        Schema::create('quotation_request_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('quotation_request_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('selected_color_id')->nullable()->constrained('colors')->nullOnDelete();
            $table->foreignId('selected_size_option_id')->nullable()->constrained('size_options')->nullOnDelete();
            $table->string('product_name');
            $table->string('product_slug')->nullable();
            $table->string('product_sku')->nullable();
            $table->string('product_image_path')->nullable();
            $table->string('selected_color_name')->nullable();
            $table->string('selected_size_name')->nullable();
            $table->decimal('unit_price', 12, 2)->default(0);
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('line_total', 12, 2)->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quotation_request_items');
        Schema::dropIfExists('quotation_requests');
    }
};
