<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductFaq extends Model
{
    protected $fillable = ['product_id', 'question', 'answer', 'sort_order'];
}
