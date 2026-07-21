<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SeoPage;
use App\Models\SeoSetting;
use Illuminate\Http\Request;

class SeoController extends Controller
{
    public function publicShow(Request $request)
    {
        $path = '/'.ltrim((string) $request->query('path', '/'), '/');
        return response()->json(SeoPage::where('path', $path)->firstOrFail());
    }

    public function index()
    {
        return response()->json([
            'pages' => SeoPage::orderBy('id')->get(),
            'robots_txt' => SeoSetting::where('key', 'robots_txt')->value('value') ?? '',
        ]);
    }

    public function update(Request $request, SeoPage $seoPage)
    {
        $seoPage->update($request->validate([
            'meta_title' => ['nullable', 'string', 'max:255'],
            'meta_description' => ['nullable', 'string', 'max:1000'],
            'is_indexable' => ['required', 'boolean'],
        ]));

        return response()->json(['message' => 'Page SEO updated.', 'page' => $seoPage]);
    }

    public function updateRobots(Request $request)
    {
        $validated = $request->validate(['robots_txt' => ['required', 'string', 'max:20000']]);
        SeoSetting::updateOrCreate(['key' => 'robots_txt'], ['value' => $validated['robots_txt']]);
        return response()->json(['message' => 'robots.txt updated.']);
    }

    public function robots()
    {
        $content = SeoSetting::where('key', 'robots_txt')->value('value') ?? "User-agent: *\nAllow: /";
        return response($content, 200)->header('Content-Type', 'text/plain; charset=UTF-8');
    }
}
