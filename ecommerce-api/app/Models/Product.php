<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'category_id',
        'sub_category_id',
        'brand_id',
        'event_id',
        'name',
        'slug',
        'price',
        'discount_price',
        'stock',
        'description',
        'image_path',
        'is_active',
    ];

    protected $appends = [
        'image_url',
        'image_urls',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'discount_price' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function subCategory(): BelongsTo
    {
        return $this->belongsTo(SubCategory::class);
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('sort_order');
    }

    public function colors(): BelongsToMany
    {
        return $this->belongsToMany(Color::class);
    }

    public function measurements(): BelongsToMany
    {
        return $this->belongsToMany(Measurement::class);
    }

    public function getImageUrlAttribute(): ?string
    {
        $firstImage = $this->relationLoaded('images')
            ? $this->images->first()
            : $this->images()->first();

        if ($firstImage) {
            return $firstImage->url;
        }

        if ($this->image_path) {
            return Storage::disk('public')->url($this->image_path);
        }

        return null;
    }

    public function getImageUrlsAttribute(): array
    {
        if ($this->relationLoaded('images')) {
            return $this->images->pluck('url')->values()->all();
        }

        return $this->images()->get()->pluck('url')->values()->all();
    }
}
