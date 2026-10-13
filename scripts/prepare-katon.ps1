# Prepara as folhas do ImageGen (4x2) para o jogo: 64x64 por quadro, núcleo em (48,32).
# Preserva o alpha, alinha pelo núcleo claro e reduz com nearest-neighbor.
param([string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
public static class KatonSheet {
  public static void Prepare(string sourcePath, string outputPath) {
    using (var source = new Bitmap(sourcePath)) {
      var frames = new Rectangle[8];
      var centers = new PointF[8];
      float scale = 1;
      for (int i = 0; i < 8; i++) {
        int x0 = i % 4 * source.Width / 4, x1 = (i % 4 + 1) * source.Width / 4;
        int y0 = i / 4 * source.Height / 2, y1 = (i / 4 + 1) * source.Height / 2;
        frames[i] = Rectangle.FromLTRB(x0, y0, x1, y1);
        int minX=x1, minY=y1, maxX=x0, maxY=y0, count=0;
        double sumX=0, sumY=0;
        for (int y=y0; y<y1; y++) for (int x=x0; x<x1; x++) {
          var c = source.GetPixel(x,y);
          if (c.A == 0) continue;
          minX=Math.Min(minX,x); minY=Math.Min(minY,y);
          maxX=Math.Max(maxX,x); maxY=Math.Max(maxY,y);
          if (c.A > 128 && c.R > 245 && c.G > 215 && c.B > 80) {
            count++; sumX+=x; sumY+=y;
          }
        }
        if (count == 0) throw new Exception("Quadro sem núcleo claro: " + i);
        float cx=(float)(sumX/count), cy=(float)(sumY/count);
        centers[i]=new PointF(cx,cy);
        scale=Math.Min(scale,46f/Math.Max(1,cx-minX));
        scale=Math.Min(scale,14f/Math.Max(1,maxX-cx));
        scale=Math.Min(scale,30f/Math.Max(1,cy-minY));
        scale=Math.Min(scale,30f/Math.Max(1,maxY-cy));
      }
      using (var output = new Bitmap(256,128,PixelFormat.Format32bppArgb)) {
        using (var g=Graphics.FromImage(output)) {
          g.InterpolationMode=InterpolationMode.NearestNeighbor;
          g.PixelOffsetMode=PixelOffsetMode.Half;
          g.CompositingMode=CompositingMode.SourceCopy;
          for (int i=0;i<8;i++) {
            var s=frames[i]; var c=centers[i];
            int dx=i%4*64, dy=i/4*64;
            g.SetClip(new Rectangle(dx,dy,64,64));
            g.DrawImage(source,new RectangleF(dx+48-(c.X-s.X)*scale,dy+32-(c.Y-s.Y)*scale,s.Width*scale,s.Height*scale),s,GraphicsUnit.Pixel);
          }
        }
        for (int i=0;i<8;i++) {
          int pixels=0;
          for (int y=0;y<64;y++) for (int x=0;x<64;x++) {
            var c=output.GetPixel(i%4*64+x,i/4*64+y);
            if(c.A==0) continue;
            pixels++;
            if(x==0 || y==0 || x==63 || y==63) throw new Exception("Quadro sem folga: " + i);
          }
          if(pixels==0) throw new Exception("Quadro vazio: " + i);
        }
        output.Save(outputPath,ImageFormat.Png);
      }
      Console.WriteLine(outputPath + " : 256x128, 8 quadros, alpha e folga conferidos");
    }
  }
}
'@
foreach ($name in @('housenka','goukakyuu')) {
  [KatonSheet]::Prepare((Join-Path $ProjectRoot "docs/arte/jutsus/projectile-$name-source.png"), (Join-Path $ProjectRoot "src/art/effects/projectile-$name.png"))
}
