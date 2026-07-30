<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class QuotationRequest extends Model
{
    protected $fillable = [
        'reference',
        'user_id',
        'customer_name',
        'email',
        'phone',
        'company',
        'project_type',
        'emirate',
        'required_by',
        'message',
        'status',
        'staff_note',
        'total_amount',
        'currency',
    ];

    protected function casts(): array
    {
        return [
            'required_by' => 'date:Y-m-d',
            'total_amount' => 'decimal:2',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(QuotationRequestItem::class);
    }
}
