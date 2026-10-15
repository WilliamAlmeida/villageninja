# Mede a frente opaca de cada folha e guarda um contato estável entre os quadros.
param([string]$ProjectRoot=(Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Collections.Generic;
public static class SpriteContactAudit {
 public static double[] Measure(string path,int cols,int rows,int frames) {
  using(var im=new Bitmap(path)) {
   int w=im.Width/cols,h=im.Height/rows;
   var xs=new List<double>();var ys=new List<double>();
   for(int i=0;i<Math.Min(frames,cols*rows);i++) {
    int right=-1;
    for(int x=w-1;x>=0;x--) {
     int n=0;for(int y=0;y<h;y++)if(im.GetPixel(i%cols*w+x,i/cols*h+y).A>=160)n++;
     if(n>=2){right=x;break;}
    }
    if(right<0)throw new Exception("Quadro sem corpo opaco: "+path);
    int sum=0,count=0;
    for(int x=Math.Max(0,right-2);x<=right;x++)for(int y=0;y<h;y++)
     if(im.GetPixel(i%cols*w+x,i/cols*h+y).A>=160){sum+=y;count++;}
    xs.Add((right+.5)/w);ys.Add((sum/(double)count+.5)/h);
   }
   xs.Sort();ys.Sort();
   return new double[]{xs[xs.Count/2],ys[ys.Count/2],h/(double)w};
  }
 }
}
'@
$config=Get-Content -Raw -Encoding UTF8 (Join-Path $ProjectRoot 'src/data/jutsu-fx.json') | ConvertFrom-Json
$result=[ordered]@{}
foreach($entry in $config.jutsus.PSObject.Properties) {
 $sprite=$entry.Value.sprite
 if(-not $sprite -or $result.Contains($sprite.sheet)){continue}
 $path=Join-Path $ProjectRoot ('src/art/effects/'+$sprite.sheet+'.png')
 $point=[SpriteContactAudit]::Measure($path,$sprite.cols,$sprite.rows,$sprite.frames)
 $result[$sprite.sheet]=[ordered]@{cols=$sprite.cols;rows=$sprite.rows;x=[Math]::Round($point[0],6);y=[Math]::Round($point[1],6);aspect=$point[2]}
 Write-Output ($sprite.sheet+': contato '+$point[0].ToString('0.000')+', '+$point[1].ToString('0.000'))
}
[IO.File]::WriteAllText((Join-Path $ProjectRoot 'src/data/sprite-contacts.json'),($result|ConvertTo-Json -Depth 5),(New-Object Text.UTF8Encoding $false))
