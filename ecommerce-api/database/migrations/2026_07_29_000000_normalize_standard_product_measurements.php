<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const STANDARD_MEASUREMENTS = [
        'length' => ['column' => 'physical_length', 'unit_column' => 'dimension_unit', 'default_unit' => 'cm', 'type' => 'dimension'],
        'width' => ['column' => 'physical_width', 'unit_column' => 'dimension_unit', 'default_unit' => 'cm', 'type' => 'dimension'],
        'height' => ['column' => 'physical_height', 'unit_column' => 'dimension_unit', 'default_unit' => 'cm', 'type' => 'dimension'],
        'weight' => ['column' => 'physical_weight', 'unit_column' => 'weight_unit', 'default_unit' => 'kg', 'type' => 'weight'],
    ];

    public function up(): void
    {
        Schema::create('product_measurement_cleanup_archive', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('measurement_product_id')
                ->unique('measurement_cleanup_link_unique');
            $table->unsignedBigInteger('product_id')->index();
            $table->unsignedBigInteger('measurement_id')->index();
            $table->string('measurement_name');
            $table->string('canonical_column');
            $table->decimal('linked_value', 12, 3)->nullable();
            $table->string('linked_unit', 20)->nullable();
            $table->decimal('canonical_value_before', 12, 3)->nullable();
            $table->string('canonical_unit_before', 20)->nullable();
            $table->boolean('has_conflict')->default(false);
            $table->timestamps();

            $table->index(
                ['product_id', 'has_conflict'],
                'measurement_cleanup_product_conflict_index'
            );
        });

        $measurements = DB::table('measurements')
            ->get(['id', 'name', 'unit'])
            ->filter(fn (object $measurement) => isset(
                self::STANDARD_MEASUREMENTS[$this->normalizeName($measurement->name)]
            ));

        foreach ($measurements as $measurement) {
            $name = $this->normalizeName($measurement->name);
            $config = self::STANDARD_MEASUREMENTS[$name];

            DB::table('measurement_product')
                ->where('measurement_id', $measurement->id)
                ->orderBy('id')
                ->chunkById(250, function ($links) use ($measurement, $config): void {
                    foreach ($links as $link) {
                        $product = DB::table('products')->where('id', $link->product_id)->first();
                        if (! $product) {
                            continue;
                        }

                        $canonicalValue = $this->number($product->{$config['column']} ?? null);
                        $canonicalUnit = $this->unit(
                            $product->{$config['unit_column']} ?? null,
                            $config['default_unit']
                        );
                        $linkedValue = $this->number($link->value ?? null);
                        $linkedUnit = $this->unit(
                            $link->unit ?? $measurement->unit ?? null,
                            $canonicalUnit
                        );
                        $hasConflict = $canonicalValue !== null
                            && $linkedValue !== null
                            && ! $this->equivalent(
                                $canonicalValue,
                                $canonicalUnit,
                                $linkedValue,
                                $linkedUnit,
                                $config['type']
                            );
                        $timestamp = date('Y-m-d H:i:s');

                        DB::table('product_measurement_cleanup_archive')->insert([
                            'measurement_product_id' => $link->id,
                            'product_id' => $link->product_id,
                            'measurement_id' => $link->measurement_id,
                            'measurement_name' => $measurement->name,
                            'canonical_column' => $config['column'],
                            'linked_value' => $linkedValue,
                            'linked_unit' => $linkedUnit,
                            'canonical_value_before' => $canonicalValue,
                            'canonical_unit_before' => $canonicalUnit,
                            'has_conflict' => $hasConflict,
                            'created_at' => $timestamp,
                            'updated_at' => $timestamp,
                        ]);

                        if ($canonicalValue === null && $linkedValue !== null) {
                            DB::table('products')
                                ->where('id', $link->product_id)
                                ->update([
                                    $config['column'] => $linkedValue,
                                    $config['unit_column'] => $linkedUnit,
                                    'updated_at' => $timestamp,
                                ]);
                        }

                        DB::table('measurement_product')->where('id', $link->id)->delete();
                    }
                });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('product_measurement_cleanup_archive')) {
            return;
        }

        DB::table('product_measurement_cleanup_archive')
            ->orderBy('id')
            ->chunkById(250, function ($archivedLinks): void {
                foreach ($archivedLinks as $archived) {
                    $productExists = DB::table('products')->where('id', $archived->product_id)->exists();
                    $measurementExists = DB::table('measurements')->where('id', $archived->measurement_id)->exists();

                    if (! $productExists || ! $measurementExists) {
                        continue;
                    }

                    DB::table('measurement_product')->insertOrIgnore([
                        'product_id' => $archived->product_id,
                        'measurement_id' => $archived->measurement_id,
                        'value' => $archived->linked_value,
                        'unit' => $archived->linked_unit,
                        'created_at' => date('Y-m-d H:i:s'),
                        'updated_at' => date('Y-m-d H:i:s'),
                    ]);
                }
            });

        Schema::dropIfExists('product_measurement_cleanup_archive');
    }

    private function normalizeName(mixed $name): string
    {
        return strtolower(trim((string) $name));
    }

    private function number(mixed $value): ?float
    {
        return $value !== null && $value !== '' && is_numeric($value) ? (float) $value : null;
    }

    private function unit(mixed $unit, string $fallback): string
    {
        $normalized = strtolower(trim((string) $unit));
        return $normalized !== '' ? $normalized : $fallback;
    }

    private function equivalent(float $first, string $firstUnit, float $second, string $secondUnit, string $type): bool
    {
        $firstBase = $this->baseValue($first, $firstUnit, $type);
        $secondBase = $this->baseValue($second, $secondUnit, $type);

        if ($firstBase === null || $secondBase === null) {
            return $firstUnit === $secondUnit && abs($first - $second) < 0.0005;
        }

        return abs($firstBase - $secondBase) < 0.0005;
    }

    private function baseValue(float $value, string $unit, string $type): ?float
    {
        $factors = $type === 'weight'
            ? ['g' => 0.001, 'kg' => 1]
            : ['mm' => 0.1, 'cm' => 1, 'm' => 100];

        return isset($factors[$unit]) ? $value * $factors[$unit] : null;
    }
};
