<?php
namespace App\Console\Commands;
use App\Models\Color;
use App\Models\Product;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MapWordPressColorImages extends Command
{
    protected $signature='wordpress:map-color-images {--database=i8055463_wp1} {--uploads= : Absolute wp-content/uploads path}';
    protected $description='Map color taxonomies and recover swatches from term or variation images';
    public function handle(): int
    {
        $uploads=rtrim((string)$this->option('uploads'),'\\/'); if(!is_dir($uploads)){ $this->error('Pass a valid --uploads path.'); return self::FAILURE; }
        $base=config('database.connections.mysql'); $base['database']=$this->option('database'); config(['database.connections.wordpress_colors'=>$base]); DB::purge('wordpress_colors'); $wp=DB::connection('wordpress_colors');
        $terms=$wp->table('wp_terms as t')->join('wp_term_taxonomy as tt','tt.term_id','=','t.term_id')->join('wp_term_relationships as tr','tr.term_taxonomy_id','=','tt.term_taxonomy_id')->join('wp_posts as p',fn($j)=>$j->on('p.ID','=','tr.object_id')->where('p.post_type','product'))->leftJoin('wp_termmeta as im',fn($j)=>$j->on('im.term_id','=','t.term_id')->where('im.meta_key','image'))->leftJoin('wp_termmeta as cm',fn($j)=>$j->on('cm.term_id','=','t.term_id')->where('cm.meta_key','color'))->where(fn($q)=>$q->where('tt.taxonomy','like','%color%')->orWhere('tt.taxonomy','like','%colour%'))->select('t.term_id','t.name','t.slug','tt.taxonomy','im.meta_value as term_image','cm.meta_value as color_value')->distinct()->get();
        $map=[]; $termImages=0; $missing=0;
        foreach($terms as $term){ $key=$term->taxonomy.':'.$term->term_id; $name=html_entity_decode($term->name,ENT_QUOTES|ENT_HTML5,'UTF-8');
            $color=Color::where('wordpress_term_id',$term->term_id)->where('source_taxonomy',$term->taxonomy)->first();
            if(!$color){ $color=Color::where('name',$name)->whereNull('wordpress_term_id')->first(); if($color) $color->update(['wordpress_term_id'=>$term->term_id,'source_taxonomy'=>$term->taxonomy]); else $color=Color::create(['name'=>$name,'wordpress_term_id'=>$term->term_id,'source_taxonomy'=>$term->taxonomy,'is_active'=>true]); }
            $relative=$this->relativeFromUrl($term->term_image); $hex=$this->toHex($term->color_value);
            if($relative && is_file($uploads.DIRECTORY_SEPARATOR.str_replace('/',DIRECTORY_SEPARATOR,$relative))) $termImages++;
            elseif($hex){ $relative=null; $color->update(['hex_code'=>$hex,'image_path'=>null,'image_alt_text'=>$color->image_alt_text?:$name]); }
            else { $relative=null; }
            if($relative){ $path=$this->copy($uploads,$relative,$term->taxonomy,$term->term_id); if($path) $color->update(['image_path'=>$path,'hex_code'=>$hex,'image_alt_text'=>$color->image_alt_text?:$name]); else $missing++; } elseif(!$hex) $missing++;
            if(!$relative && !$hex && $color->image_path){ $oldPath=$color->image_path; $color->update(['image_path'=>null]); if(!Color::where('image_path',$oldPath)->exists() && str_starts_with($oldPath,'colors/')) Storage::disk('public')->delete($oldPath); }
            $map[$key]=$color->id;
        }
        $relations=$wp->table('wp_term_relationships as tr')->join('wp_term_taxonomy as tt','tt.term_taxonomy_id','=','tr.term_taxonomy_id')->join('wp_terms as t','t.term_id','=','tt.term_id')->where(fn($q)=>$q->where('tt.taxonomy','like','%color%')->orWhere('tt.taxonomy','like','%colour%'))->get(['tr.object_id','tt.term_id','tt.taxonomy','t.slug'])->groupBy('object_id');
        $mappedProducts=0; $variationLinks=0;
        foreach($relations as $wordpressId=>$rows){ $product=Product::with(['images','colors'])->where('wordpress_id',$wordpressId)->first(); if(!$product)continue; $sync=[];
            foreach($rows as $row){ $colorId=$map[$row->taxonomy.':'.$row->term_id]??null; if(!$colorId)continue; $imageId=null; $variation=$this->variationImageForProduct($wp,$row->taxonomy,$row->slug,(int)$wordpressId);
                if($variation){ $image=$product->images->first(fn($item)=>str_starts_with(basename($item->path),$variation->attachment_id.'-')); if($image){ $imageId=$image->id; $variationLinks++; } }
                if(!$imageId){ $existingId=$product->colors->firstWhere('id',$colorId)?->pivot?->product_image_id; if($existingId && $product->images->contains('id',$existingId)) $imageId=$existingId; }
                $sync[$colorId]=['product_image_id'=>$imageId];
            }
            $product->colors()->sync($sync); $mappedProducts++;
        }
        $this->info("Mapped {$mappedProducts} products. True term images: {$termImages}; swatches without term image or color value: {$missing}.");
        $this->info("Gallery links: {$variationLinks} exact original WordPress attachment matches; no variation images copied."); return self::SUCCESS;
    }
    private function variationImageForProduct($wp,string $taxonomy,string $slug,int $wordpressProductId): ?object { return $wp->table('wp_postmeta as a')->join('wp_posts as v',fn($j)=>$j->on('v.ID','=','a.post_id')->where('v.post_type','product_variation'))->join('wp_postmeta as th',fn($j)=>$j->on('th.post_id','=','v.ID')->where('th.meta_key','_thumbnail_id'))->join('wp_postmeta as f',fn($j)=>$j->on('f.post_id','=',DB::raw('CAST(th.meta_value AS UNSIGNED)'))->where('f.meta_key','_wp_attached_file'))->where('v.post_parent',$wordpressProductId)->where('a.meta_key','attribute_'.$taxonomy)->where('a.meta_value',$slug)->where('th.meta_value','<>','')->where('th.meta_value','<>','0')->where('f.meta_value','<>','')->selectRaw('CAST(th.meta_value AS UNSIGNED) as attachment_id, f.meta_value as relative_path')->first(); }
    private function relativeFromUrl($url): ?string { return is_string($url)&&str_contains($url,'/wp-content/uploads/')?urldecode(Str::after($url,'/wp-content/uploads/')):null; }
    private function toHex($value): ?string { if(!is_string($value)||trim($value)==='')return null; $value=trim($value); if(preg_match('/^#[0-9a-f]{6}$/i',$value))return strtoupper($value); if(preg_match('/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i',$value,$m))return sprintf('#%02X%02X%02X',min(255,$m[1]),min(255,$m[2]),min(255,$m[3])); return null; }
    private function copy(string $uploads,string $relative,string $taxonomy,int $id): ?string { $relative=str_replace(['\\','/'],DIRECTORY_SEPARATOR,ltrim($relative,'\\/')); $source=$uploads.DIRECTORY_SEPARATOR.$relative;
        if(!is_file($source)){ $directory=dirname($source); preg_match_all('/[A-Za-z0-9]{4,}/',pathinfo($source,PATHINFO_FILENAME),$tokens); $token=end($tokens[0]); if($token&&is_dir($directory)){ $matches=File::glob($directory.DIRECTORY_SEPARATOR.'*'.$token.'*.*'); usort($matches,fn($a,$b)=>strlen(basename($a))<=>strlen(basename($b))); $source=$matches[0]??$source; } }
        if(!is_file($source))return null; $ext=strtolower(pathinfo($source,PATHINFO_EXTENSION)); $targetRelative='colors/'.$id.'-'.Str::slug($taxonomy).'-'.Str::slug(pathinfo($source,PATHINFO_FILENAME)).'.'.$ext; $target=storage_path('app/public/'.str_replace('/',DIRECTORY_SEPARATOR,$targetRelative)); File::ensureDirectoryExists(dirname($target)); File::copy($source,$target); return $targetRelative; }
}
