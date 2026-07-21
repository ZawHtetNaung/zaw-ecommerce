<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SeoPage extends Model
{
    protected $fillable = ['page_key', 'name', 'path', 'meta_title', 'meta_description', 'is_indexable'];

    protected function casts(): array
    {
        return ['is_indexable' => 'boolean'];
    }
}
