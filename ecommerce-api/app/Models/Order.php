<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    protected $fillable = [
        'reference',
        'user_id',
        'customer_name',
        'email',
        'phone',
        'emirate_code',
        'city_area',
        'address_line_1',
        'address_line_2',
        'delivery_notes',
        'status',
        'payment_status',
        'payment_method',
        'staff_note',
        'subtotal',
        'shipping_amount',
        'shipping_tax',
        'total_amount',
        'currency',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'shipping_amount' => 'decimal:2',
            'shipping_tax' => 'decimal:2',
            'total_amount' => 'decimal:2',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }
}
