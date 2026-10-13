# Preparo técnico das imagens geradas: grade, escala comum, alpha e margem.
param([string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
public static class RasenganImpactSheet {
 public static void Prepare(string root) {
  string dir=System.IO.Path.Combine(root,"docs/arte/jutsus/rasengan");
  string output=System.IO.Path.Combine(root,"src/art/effects");
  using(var src=new Bitmap(System.IO.Path.Combine(dir,"impact-padded-source.png")))
  using(var dst=new Bitmap(384,192,PixelFormat.Format32bppArgb)) {
   for(int i=0;i<8;i++) {
    int cw=src.Width/4,ch=src.Height/2;
    // Escala comum preserva o crescimento da explosão entre os quadros.
    float scale=80f/Math.Max(cw,ch);
    for(int y=0;y<96;y++)for(int x=0;x<96;x++) {
     int sx=(int)Math.Floor((x+0.5f-48)/scale+cw*0.5f);
     int sy=(int)Math.Floor((y+0.5f-96*0.72f)/scale+ch*0.86f);
     if(sx<0||sy<0||sx>=cw||sy>=ch)continue;
     Color c=src.GetPixel(i%4*cw+sx,i/4*ch+sy);
     if(c.A<32)continue;
     dst.SetPixel(i%4*96+x,i/4*96+y,c);
    }
   }
   dst.Save(System.IO.Path.Combine(output,"effect-rasengan-impact-v1.png"),ImageFormat.Png);
  }
  using(var src=new Bitmap(System.IO.Path.Combine(dir,"crater-source.png")))
  using(var dst=new Bitmap(128,64,PixelFormat.Format32bppArgb))
  using(var g=Graphics.FromImage(dst)) {
   g.InterpolationMode=InterpolationMode.NearestNeighbor;
   g.PixelOffsetMode=PixelOffsetMode.Half;
   g.DrawImage(src,new Rectangle(0,0,128,64),0,0,src.Width,src.Height,GraphicsUnit.Pixel);
   for(int y=0;y<64;y++)for(int x=0;x<128;x++)if(dst.GetPixel(x,y).A<32)dst.SetPixel(x,y,Color.Transparent);
   dst.Save(System.IO.Path.Combine(output,"effect-rasengan-crater-v1.png"),ImageFormat.Png);
  }
 }
}
'@
[RasenganImpactSheet]::Prepare($ProjectRoot)
