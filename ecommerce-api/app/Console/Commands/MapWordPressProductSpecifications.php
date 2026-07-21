<?php
namespace App\Console\Commands;
use App\Models\Product;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class MapWordPressProductSpecifications extends Command
{
    protected $signature = 'wordpress:map-specifications {--database=i8055463_wp1}';
    protected $description = 'Map canonical WooCommerce dimensions into shipping and type-specific product details';
    public function handle(): int
    {
        $base=config('database.connections.mysql'); $base['database']=$this->option('database'); config(['database.connections.wordpress_specs'=>$base]); DB::purge('wordpress_specs');
        $rows=DB::connection('wordpress_specs')->table('wp_postmeta')->whereIn('meta_key',['_length','_width','_height','_weight'])->where('meta_value','<>','')->get()->groupBy('post_id');
        $mapped=0; $skippedWeights=0; $flooringDetails=0; $wallpaperDetails=0;
        foreach($rows as $wordpressId=>$meta){ $product=Product::where('wordpress_id',$wordpressId)->first(); if(!$product) continue; $values=$meta->pluck('meta_value','meta_key');
            $data=['physical_length'=>$this->number($values['_length']??null),'physical_width'=>$this->number($values['_width']??null),'physical_height'=>$this->number($values['_height']??null)];
            $weight=$this->number($values['_weight']??null); if($weight!==null && $weight<=500) $data['physical_weight']=$weight; elseif($weight!==null) $skippedWeights++;
            $product->update($data);
            if($product->product_type==='flooring' && array_filter([$data['physical_length'],$data['physical_width'],$data['physical_height']])){
                $product->flooringDetail()->updateOrCreate([],['piece_length'=>$data['physical_length'],'piece_width'=>$data['physical_width'],'thickness'=>$data['physical_height']]); $flooringDetails++;
            } elseif($product->product_type==='wallpaper' && $data['physical_length']!==null && $data['physical_width']!==null){
                $product->wallpaperDetail()->updateOrCreate([],['roll_length'=>$data['physical_length'],'roll_width'=>$data['physical_width'],'coverage_per_roll'=>round(($data['physical_length']*$data['physical_width'])/10000,3)]); $wallpaperDetails++;
            }
            $mapped++;
        }
        $this->info("Mapped specifications to {$mapped} products; {$flooringDetails} flooring detail rows and {$wallpaperDetails} wallpaper detail rows; skipped {$skippedWeights} implausible weights over 500 kg."); return self::SUCCESS;
    }
    private function number($value): ?float { return is_numeric($value) && (float)$value>=0 ? (float)$value : null; }
}
