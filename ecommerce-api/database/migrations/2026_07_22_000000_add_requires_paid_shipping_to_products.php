<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Products directly assigned to the legacy WordPress Special Collection.
     * WordPress retained multiple product categories, while the normalized
     * catalog keeps a single primary category, so this policy must be stored.
     */
    private const LEGACY_SPECIAL_COLLECTION_PRODUCT_IDS = [
        8744, 8762, 8788, 8803, 8813, 8817, 8832, 8846, 8857, 8871, 8885,
        9209, 9225, 10130, 10180, 10232, 10510, 10524, 10533, 10548, 10559,
        10574, 10736, 10746, 10758, 10770, 11819, 11832, 11848, 11860, 11873,
        11885, 11890, 11917, 11925, 12043, 12048, 13312, 13335, 13356, 13634,
        19449, 20137,
        20292, 20301, 20303, 20325, 20328, 20331, 20334, 20815, 23789, 23862,
        24041, 24347, 24436, 24438, 24531, 24532,
    ];

    public function up(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->boolean('requires_paid_shipping')->default(false)->after('is_in_stock')->index();
        });

        DB::table('products')
            ->whereIn('wordpress_id', self::LEGACY_SPECIAL_COLLECTION_PRODUCT_IDS)
            ->update(['requires_paid_shipping' => true]);

        $specialCollectionCategoryId = DB::table('categories')
            ->where('slug', 'special-collection')
            ->value('id');

        if ($specialCollectionCategoryId !== null) {
            DB::table('products')
                ->where('category_id', $specialCollectionCategoryId)
                ->update(['requires_paid_shipping' => true]);
        }
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table): void {
            $table->dropIndex(['requires_paid_shipping']);
            $table->dropColumn('requires_paid_shipping');
        });
    }
};
