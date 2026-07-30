<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\QuotationRequestReceived;
use App\Models\Product;
use App\Models\QuotationRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class QuotationRequestController extends Controller
{
    private const STATUSES = ['new', 'contacted', 'quoted', 'closed'];

    public function publicStore(Request $request)
    {
        $validated = $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['required', 'string', 'max:50'],
            'company' => ['nullable', 'string', 'max:255'],
            'project_type' => ['nullable', 'string', Rule::in(['residential', 'commercial', 'hospitality', 'office', 'other'])],
            'emirate' => ['nullable', 'string', 'max:100'],
            'required_by' => ['nullable', 'date'],
            'message' => ['nullable', 'string', 'max:5000'],
            'items' => ['required', 'array', 'min:1', 'max:50'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:9999'],
            'items.*.selected_color_id' => ['nullable', 'integer', 'exists:colors,id'],
            'items.*.selected_size_option_id' => ['nullable', 'integer', 'exists:size_options,id'],
        ]);

        $products = Product::query()
            ->with(['images', 'colors', 'sizeOptions'])
            ->where('is_active', true)
            ->whereIn('id', collect($validated['items'])->pluck('product_id'))
            ->get()
            ->keyBy('id');

        $preparedItems = $this->prepareItems(collect($validated['items']), $products);
        $totalAmount = $preparedItems->sum('line_total');

        $quotation = DB::transaction(function () use ($validated, $preparedItems, $totalAmount): QuotationRequest {
            $quotation = QuotationRequest::create([
                'reference' => $this->newReference(),
                'user_id' => Auth::guard('sanctum')->id(),
                'customer_name' => trim($validated['customer_name']),
                'email' => trim($validated['email']),
                'phone' => trim($validated['phone']),
                'company' => $this->nullableTrim($validated['company'] ?? null),
                'project_type' => $validated['project_type'] ?? null,
                'emirate' => $this->nullableTrim($validated['emirate'] ?? null),
                'required_by' => $validated['required_by'] ?? null,
                'message' => $this->nullableTrim($validated['message'] ?? null),
                'status' => 'new',
                'total_amount' => $totalAmount,
                'currency' => 'AED',
            ]);

            $quotation->items()->createMany($preparedItems->all());

            return $quotation->load('items');
        });

        $this->sendNotifications($quotation);

        return response()->json([
            'message' => 'Your quotation request has been sent successfully.',
            'reference' => $quotation->reference,
            'quotation' => $quotation,
        ], 201);
    }

    public function index()
    {
        return response()->json(
            QuotationRequest::query()
                ->with('items')
                ->latest()
                ->get()
        );
    }

    public function show(QuotationRequest $quotationRequest)
    {
        return response()->json($quotationRequest->load('items'));
    }

    public function update(Request $request, QuotationRequest $quotationRequest)
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(self::STATUSES)],
            'staff_note' => ['nullable', 'string', 'max:5000'],
        ]);

        $quotationRequest->update([
            'status' => $validated['status'],
            'staff_note' => $this->nullableTrim($validated['staff_note'] ?? null),
        ]);

        return response()->json([
            'message' => "{$quotationRequest->reference} updated successfully.",
            'quotation' => $quotationRequest->fresh()->load('items'),
        ]);
    }

    public function destroy(QuotationRequest $quotationRequest)
    {
        $reference = $quotationRequest->reference;
        $quotationRequest->delete();

        return response()->json([
            'message' => "{$reference} deleted successfully.",
        ]);
    }

    private function prepareItems(Collection $submittedItems, Collection $products): Collection
    {
        return $submittedItems->map(function (array $submitted, int $index) use ($products): array {
            /** @var Product|null $product */
            $product = $products->get((int) $submitted['product_id']);
            if (! $product) {
                throw ValidationException::withMessages([
                    "items.{$index}.product_id" => 'This product is no longer available.',
                ]);
            }

            $colorId = isset($submitted['selected_color_id']) ? (int) $submitted['selected_color_id'] : null;
            $sizeId = isset($submitted['selected_size_option_id']) ? (int) $submitted['selected_size_option_id'] : null;
            $selectedColor = $colorId ? $product->colors->firstWhere('id', $colorId) : null;
            $selectedSize = $sizeId ? $product->sizeOptions->firstWhere('id', $sizeId) : null;

            if (($colorId || $product->colors->isNotEmpty()) && ! $selectedColor) {
                throw ValidationException::withMessages([
                    "items.{$index}.selected_color_id" => 'Choose a colour offered for this product.',
                ]);
            }
            if (($sizeId || $product->sizeOptions->isNotEmpty()) && ! $selectedSize) {
                throw ValidationException::withMessages([
                    "items.{$index}.selected_size_option_id" => 'Choose a size offered for this product.',
                ]);
            }

            $quantity = (int) $submitted['quantity'];
            $discountPrice = (float) ($product->discount_price ?? 0);
            $unitPrice = $discountPrice > 0 ? $discountPrice : (float) $product->price;
            $selectedProductImageId = (int) ($selectedColor?->pivot?->product_image_id ?? 0);
            $quoteImage = $selectedProductImageId
                ? $product->images->firstWhere('id', $selectedProductImageId)
                : null;
            $quoteImage ??= $product->images->first();

            return [
                'product_id' => $product->id,
                'selected_color_id' => $selectedColor?->id,
                'selected_size_option_id' => $selectedSize?->id,
                'product_name' => $product->name,
                'product_slug' => $product->slug,
                'product_sku' => $product->sku,
                'product_image_path' => $quoteImage?->path ?: $product->image_path,
                'selected_color_name' => $selectedColor?->name,
                'selected_size_name' => $selectedSize?->name,
                'unit_price' => round($unitPrice, 2),
                'quantity' => $quantity,
                'line_total' => round($unitPrice * $quantity, 2),
            ];
        });
    }

    private function newReference(): string
    {
        do {
            $reference = 'MLQ-'.now()->format('Ymd').'-'.Str::upper(Str::random(6));
        } while (QuotationRequest::where('reference', $reference)->exists());

        return $reference;
    }

    private function nullableTrim(?string $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    private function sendNotifications(QuotationRequest $quotation): void
    {
        $recipient = trim((string) config('quotation.notification_email'));
        if ($recipient === '') {
            return;
        }

        try {
            Mail::to($recipient)->send(new QuotationRequestReceived($quotation));
        } catch (\Throwable $exception) {
            Log::warning('Quotation request stored but notification email failed.', [
                'quotation_id' => $quotation->id,
                'message' => $exception->getMessage(),
            ]);
        }
    }
}
