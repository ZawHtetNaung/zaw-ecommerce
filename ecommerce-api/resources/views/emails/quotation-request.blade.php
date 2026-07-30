<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Quotation request {{ $quotation->reference }}</title>
</head>
<body style="margin:0;background:#f4f4f2;color:#171717;font-family:Arial,sans-serif">
    <div style="max-width:720px;margin:0 auto;padding:36px 18px">
        <div style="background:#fff;border:1px solid #dedede;padding:34px">
            <p style="margin:0 0 8px;color:#777;font-size:12px;letter-spacing:1px;text-transform:uppercase">New quotation request</p>
            <h1 style="margin:0 0 28px;font-size:28px">{{ $quotation->reference }}</h1>

            <table role="presentation" style="width:100%;border-collapse:collapse;margin-bottom:28px">
                <tr><td style="padding:6px 0;color:#777">Customer</td><td style="padding:6px 0;text-align:right"><strong>{{ $quotation->customer_name }}</strong></td></tr>
                <tr><td style="padding:6px 0;color:#777">Email</td><td style="padding:6px 0;text-align:right">{{ $quotation->email }}</td></tr>
                <tr><td style="padding:6px 0;color:#777">Phone</td><td style="padding:6px 0;text-align:right">{{ $quotation->phone }}</td></tr>
                @if($quotation->company)
                    <tr><td style="padding:6px 0;color:#777">Company</td><td style="padding:6px 0;text-align:right">{{ $quotation->company }}</td></tr>
                @endif
                @if($quotation->emirate)
                    <tr><td style="padding:6px 0;color:#777">Emirate</td><td style="padding:6px 0;text-align:right">{{ $quotation->emirate }}</td></tr>
                @endif
            </table>

            <h2 style="margin:0 0 12px;font-size:20px">Products</h2>
            @foreach($quotation->items as $item)
                <div style="padding:14px 0;border-top:1px solid #e6e6e6">
                    <strong>{{ $item->product_name }}</strong>
                    <div style="margin-top:5px;color:#666;font-size:14px">
                        Quantity: {{ $item->quantity }}
                        @if($item->selected_color_name) · Colour: {{ $item->selected_color_name }} @endif
                        @if($item->selected_size_name) · Size: {{ $item->selected_size_name }} @endif
                    </div>
                    <div style="margin-top:5px">AED {{ $item->line_total }}</div>
                </div>
            @endforeach

            <div style="padding:18px 0;border-top:2px solid #171717;text-align:right;font-size:20px">
                Reference total: <strong>AED {{ $quotation->total_amount }}</strong>
            </div>

            @if($quotation->message)
                <div style="margin-top:22px;padding:18px;background:#f6f6f4">
                    <strong>Customer message</strong>
                    <p style="margin:8px 0 0;line-height:1.6">{{ $quotation->message }}</p>
                </div>
            @endif
        </div>
    </div>
</body>
</html>
