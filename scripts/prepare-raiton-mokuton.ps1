# Preparo técnico do lote Raiton/Mokuton: alpha, grade, âncoras e escala comum por folha.
param([string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent), [string[]]$Only = @())
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
public static class RaitonWoodSheets {
 public static void Prepare(string input,string output,int cell,bool ground,float baseInset) {
  using(var src=new Bitmap(input)) using(var dst=new Bitmap(cell*4,cell*2,PixelFormat.Format32bppArgb)) {
   int cw=src.Width/4,ch=src.Height/2,n=cw*ch;
   var masks=new Color[8][];var bounds=new Rectangle[8];float scale=1;int widest=0;
   for(int i=0;i<8;i++) {
    var colors=new Color[n];var labels=new int[n];var queue=new int[n];var sizes=new int[n+1];
    for(int y=0;y<ch;y++)for(int x=0;x<cw;x++)colors[y*cw+x]=src.GetPixel(i%4*cw+x,i/4*ch+y);
    int label=0;
    for(int start=0;start<n;start++) {
     if(labels[start]!=0||colors[start].A<32)continue;
     label++;int read=0,write=1;queue[0]=start;labels[start]=label;
     while(read<write) {
      int p=queue[read++],x=p%cw,y=p/cw;
      for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++) {
       int xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=cw||yy>=ch)continue;int k=yy*cw+xx;
       if(labels[k]!=0||colors[k].A<32)continue;labels[k]=label;queue[write++]=k;
      }
     }
     sizes[label]=write;
    }
    int lx=cw,ly=ch,rx=0,ry=0;var mask=new Color[n];masks[i]=mask;
    for(int y=0;y<ch;y++)for(int x=0;x<cw;x++) {
     int k=y*cw+x,lab=labels[k];if(lab==0||sizes[lab]<32)continue;
     mask[k]=colors[k];lx=Math.Min(lx,x);ly=Math.Min(ly,y);rx=Math.Max(rx,x+1);ry=Math.Max(ry,y+1);
    }
    if(rx<=lx||ry<=ly)throw new Exception("Quadro vazio: "+i+" em "+input);
    bounds[i]=Rectangle.FromLTRB(lx,ly,rx,ry);widest=Math.Max(widest,rx-lx);
    scale=Math.Min(scale,ground?Math.Min(cell*.76f/(rx-lx),cell*.62f/(ry-ly)):cell*.7f/Math.Max(rx-lx,ry-ly));
   }
   for(int i=0;i<8;i++) {
    var b=bounds[i];float ax=ground?cw/2f:(b.Left+b.Right)/2f;
    // Cabeça desce entre os quatro primeiros quadros; impacto mantém referência fixa do chão.
    float ay=ground?(input.EndsWith("kirin-source.png")?(i<4?b.Bottom+(3-i)*ch*.12f:ch*.78f):b.Bottom-widest*baseInset):(b.Top+b.Bottom)/2f;
    for(int y=0;y<cell;y++)for(int x=0;x<cell;x++) {
     int sx=(int)Math.Floor((x+.5f-cell*.5f)/scale+ax);
     int sy=(int)Math.Floor((y+.5f-cell*(ground?.78f:.5f))/scale+ay);
     if(sx<0||sy<0||sx>=cw||sy>=ch)continue;
     var c=masks[i][sy*cw+sx];if(c.A>=32)dst.SetPixel(i%4*cell+x,i/4*cell+y,c);
    }
   }
   for(int y=0;y<dst.Height;y++)for(int x=0;x<dst.Width;x++)
    if((x%cell==0||x%cell==cell-1||y%cell==0||y%cell==cell-1)&&dst.GetPixel(x,y).A>0)
     throw new Exception("Arte sem margem: "+output);
   dst.Save(output,ImageFormat.Png);
   Console.WriteLine(System.IO.Path.GetFileName(output)+": "+dst.Width+"x"+dst.Height+", RGBA, 8 quadros com margem.");
  }
 }
}
'@
$sourceDir = Join-Path $ProjectRoot 'docs/arte/jutsus/raiton-mokuton'
$outputDir = Join-Path $ProjectRoot 'src/art/effects'
$sheets = @(
 @('kirin','effect-kirin-v1',128,$true),
 @('jukai','effect-jukai-v1',96,$true),
 @('raikyuu','projectile-raikyuu-v1',64,$false),
 @('chidorinagashi','effect-chidorinagashi-v1',128,$true)
)
foreach ($sheet in $sheets) {
 if ($Only.Count -gt 0 -and $sheet[0] -notin $Only) { continue }
 $baseInset = 0.04
 [RaitonWoodSheets]::Prepare((Join-Path $sourceDir ($sheet[0]+'-source.png')),(Join-Path $outputDir ($sheet[1]+'.png')),$sheet[2],$sheet[3],$baseInset)
}
