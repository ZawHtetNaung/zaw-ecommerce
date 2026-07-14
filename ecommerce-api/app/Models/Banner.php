<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Banner extends Model
{
    use HasFactory;

    protected $fillable = [
        'wordpress_id',
        'title',
        'subtitle',
        'button_text',
        'button_link',
        'source_url',
        'button_pos_x',
        'button_pos_y',
        'button_style',
        'button_radius',
        'button_bg_color',
        'button_text_color',
        'button_width',
        'button_height',
        'button_text_size',
        'image_path',
        'is_active',
        'sort_order',
    ];

    protected $appends = [
        'image_url',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function getImageUrlAttribute(): ?string
    {
        if (! $this->image_path) {
            return null;
        }

        return Storage::disk('public')->url($this->image_path);
    }
}
