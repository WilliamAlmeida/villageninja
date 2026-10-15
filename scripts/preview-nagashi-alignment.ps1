# Monta os oito quadros com o mesmo marcador e a mesma linha dos pés.
param([string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
public static class NagashiContactSheet {
 public static void Save(string input,string output,float size,float anchorY,float dy) {
  using(var src=new Bitmap(input))
  using(var dst=new Bitmap(768,384,PixelFormat.Format32bppArgb))
  using(var g=Graphics.FromImage(dst))
  using(var body=new SolidBrush(Color.FromArgb(38,55,71)))
  using(var skin=new SolidBrush(Color.FromArgb(219,187,155)))
  using(var guide=new Pen(Color.FromArgb(65,83,55)))
  using(var label=new SolidBrush(Color.White))
  using(var font=new Font("Arial",10)) {
   g.Clear(Color.FromArgb(137,148,105));
   g.InterpolationMode=InterpolationMode.NearestNeighbor;
   g.PixelOffsetMode=PixelOffsetMode.Half;
   for(int i=0;i<8;i++) {
    int x=i%4*192,y=i/4*192,cx=x+96,feet=y+145;
    g.DrawLine(guide,x+8,feet,x+184,feet);
    g.FillRectangle(body,cx-5,feet-23,10,16);
    g.FillRectangle(body,cx-7,feet-8,5,8);
    g.FillRectangle(body,cx+2,feet-8,5,8);
    g.FillRectangle(skin,cx-4,feet-32,8,8);
    float top=y+136+dy-size*anchorY;
    g.DrawImage(src,new RectangleF(cx-size*.5f,top,size,size),
      new RectangleF(i%4*128,i/4*128,128,128),GraphicsUnit.Pixel);
    g.DrawString("Quadro "+(i+1),font,label,x+8,y+8);
    g.DrawRectangle(guide,x,y,191,191);
   }
   dst.Save(output,ImageFormat.Png);
  }
 }
}
'@
$fx = (Get-Content -Raw (Join-Path $ProjectRoot 'src/data/jutsu-fx.json') | ConvertFrom-Json).jutsus.chidorinagashi.impact
[NagashiContactSheet]::Save((Join-Path $ProjectRoot 'src/art/effects/effect-chidorinagashi-v1.png'),(Join-Path $ProjectRoot 'docs/arte/jutsus/raiton-mokuton/nagashi-alinhamento.png'),$fx.size,$fx.anchorY,$fx.dy)
