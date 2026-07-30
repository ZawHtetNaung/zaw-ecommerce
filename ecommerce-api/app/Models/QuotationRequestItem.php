<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class QuotationRequestItem extends Model
{
    protected $fillable = [
        'product_id',
        'selected_color_id',
        'selected_size_option_id',
        'product_name',
        'product_slug',
        'product_sku',
        'product_image_path',
        'selected_color_name',
        'selected_size_name',
        'unit_price',
        'quantity',
        'line_total',
    ];

    protected $appends = [
        'product_image_url',
    ];

    protected function casts(): array
    {
        return [
            'unit_price' => 'decimal:2',
            'quantity' => 'integer',
            'line_total' => 'decimal:2',
        ];
    }

    public function quotationRequest(): BelongsTo
    {
        return $this->belongsTo(QuotationRequest::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function selectedColor(): BelongsTo
    {
        return $this->belongsTo(Color::class, 'selected_color_id');
    }

    public function selectedSizeOption(): BelongsTo
    {
        return $this->belongsTo(SizeOption::class, 'selected_size_option_id');
    }

    public function getProductImageUrlAttribute(): ?string
    {
        return $this->product_image_path
            ? Storage::disk('public')->url($this->product_image_path)
            : null;
    }
}
