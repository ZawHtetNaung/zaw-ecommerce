<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\QuotationRequest;
use Illuminate\Support\Collection;

class AdminNotificationController extends Controller
{
    public function index()
    {
        $newOrders = Order::query()
            ->where('status', 'new')
            ->latest()
            ->limit(8)
            ->get();
        $newQuotations = QuotationRequest::query()
            ->where('status', 'new')
            ->latest()
            ->limit(8)
            ->get();

        $items = $newOrders
            ->map(fn (Order $order): array => [
                'id' => "order-{$order->id}",
                'type' => 'order',
                'record_id' => $order->id,
                'reference' => $order->reference,
                'customer_name' => $order->customer_name,
                'amount' => $order->total_amount,
                'currency' => $order->currency,
                'created_at' => $order->created_at,
                'route' => '/dashboard/orders',
            ])
            ->concat($newQuotations->map(fn (QuotationRequest $quotation): array => [
                'id' => "quotation-{$quotation->id}",
                'type' => 'quotation',
                'record_id' => $quotation->id,
                'reference' => $quotation->reference,
                'customer_name' => $quotation->customer_name,
                'amount' => $quotation->total_amount,
                'currency' => $quotation->currency,
                'created_at' => $quotation->created_at,
                'route' => '/dashboard/quotations',
            ]))
            ->sortByDesc('created_at')
            ->take(10)
            ->values();

        return response()->json([
            'unread_count' => Order::query()->where('status', 'new')->count()
                + QuotationRequest::query()->where('status', 'new')->count(),
            'order_count' => Order::query()->where('status', 'new')->count(),
            'quotation_count' => QuotationRequest::query()->where('status', 'new')->count(),
            'items' => $items instanceof Collection ? $items->all() : $items,
        ]);
    }
}
