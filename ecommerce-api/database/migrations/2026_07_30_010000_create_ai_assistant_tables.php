<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_knowledge_entries', function (Blueprint $table): void {
            $table->id();
            $table->string('title');
            $table->string('topic', 60)->index();
            $table->text('content');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true)->index();
            $table->timestamps();
        });

        Schema::create('ai_chat_sessions', function (Blueprint $table): void {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('locale', 12)->default('en');
            $table->text('page_url')->nullable();
            $table->string('status', 30)->default('open')->index();
            $table->boolean('handed_off')->default(false);
            $table->timestamp('last_message_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('ai_chat_messages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('ai_chat_session_id')->constrained()->cascadeOnDelete();
            $table->string('role', 20);
            $table->text('content');
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        $now = now();
        DB::table('ai_knowledge_entries')->insert([
            [
                'title' => 'About Messara Living',
                'topic' => 'company',
                'content' => 'Messara Living supplies furniture, outdoor furniture, flooring, wallpaper, accessories, kids collections, balcony sets, and special collections for homes, hospitality, and commercial spaces across the UAE.',
                'sort_order' => 10,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'title' => 'Dubai showroom',
                'topic' => 'showrooms',
                'content' => 'Dubai Showroom: Messara Living Showroom, Umm Suqeim Road, Al Barsha 2, Dubai, UAE. Telephone: +971 4 359 7374. Toll free: 800 MESSARA (637 72 72). Open every day from 9 AM to 10 PM.',
                'sort_order' => 20,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'title' => 'Sharjah gallery',
                'topic' => 'showrooms',
                'content' => 'Sharjah Gallery: Messara Living Gallery, Sharjah Furniture Complex, Industrial Area 4, Sharjah. Telephone: +971 6 533 1111. Saturday to Thursday 9 AM to 10 PM; Friday 2 PM to 10 PM.',
                'sort_order' => 30,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'title' => 'Customer contact',
                'topic' => 'contact',
                'content' => 'Customers can email hello@messaraliving.com or chat on WhatsApp at +971 54 305 7077. Use WhatsApp for stock, delivery, installation, order, project, and policy questions that require a staff member.',
                'sort_order' => 40,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'title' => 'UAE delivery charges',
                'topic' => 'delivery',
                'content' => 'Standard delivery is AED 350 for Dubai, Sharjah, and Ajman, and becomes free from AED 1,500. Standard delivery is AED 750 for Abu Dhabi, Al Ain, Western Region, Al Ruwais, Hatta, Fujairah, Ras Al Khaimah, and Umm Al Quwain, and becomes free from AED 3,000. Products marked as requiring paid shipping do not receive the free-delivery threshold. The checkout calculates the final delivery amount from the cart and destination.',
                'sort_order' => 50,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'title' => 'Delivery and assembly service',
                'topic' => 'services',
                'content' => 'Messara Living provides UAE-wide delivery. Assembly and placement are available for eligible products. Timing depends on product availability and the delivery destination, so exact dates and installation eligibility must be confirmed by the team.',
                'sort_order' => 60,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'title' => 'Design and project services',
                'topic' => 'services',
                'content' => 'The team can help with furniture, flooring, wallpaper, interior product selection, measurements, style, budget, commercial projects, hospitality projects, and after-sales product care.',
                'sort_order' => 70,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'title' => 'Quotation requests',
                'topic' => 'quotation',
                'content' => 'Customers can request a quotation without logging in. The quotation page supports multiple products, quantities, selected colours and sizes, project information, and a message. A Messara Living team member follows up after submission.',
                'sort_order' => 80,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'title' => 'Policies and commitments',
                'topic' => 'policies',
                'content' => 'The assistant must not invent return, refund, warranty, order-status, installation, customisation, or delivery-date commitments. When an exact approved rule is not present in this knowledge base, direct the customer to Messara Living staff by WhatsApp or telephone.',
                'sort_order' => 90,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_chat_messages');
        Schema::dropIfExists('ai_chat_sessions');
        Schema::dropIfExists('ai_knowledge_entries');
    }
};
