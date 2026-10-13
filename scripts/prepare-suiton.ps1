# Preparo técnico das folhas ImageGen 4x2; preserva alpha e usa nearest-neighbor.
param([string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
public static class SuitonSheet {
  public static void Prepare(string sourcePath, string outputPath, bool sphere) {
    using(var source=new Bitmap(sourcePath)) {
      var frames=new Rectangle[8]; var centers=new PointF[8]; float scale=1;
      for(int i=0;i<8;i++) {
        int x0=i%4*source.Width/4, x1=(i%4+1)*source.Width/4;
        int y0=i/4*source.Height/2, y1=(i/4+1)*source.Height/2;
        frames[i]=Rectangle.FromLTRB(x0,y0,x1,y1);
        int minX=x1,minY=y1,maxX=x0,maxY=y0;
        int bodyMinX=x1,bodyMinY=y1,bodyMaxX=x0,bodyMaxY=y0,count=0;
        for(int y=y0;y<y1;y++) for(int x=x0;x<x1;x++) {
          var c=source.GetPixel(x,y); if(c.A==0) continue;
          minX=Math.Min(minX,x); minY=Math.Min(minY,y); maxX=Math.Max(maxX,x); maxY=Math.Max(maxY,y);
          if(c.A>96) {
            bodyMinX=Math.Min(bodyMinX,x); bodyMinY=Math.Min(bodyMinY,y);
            bodyMaxX=Math.Max(bodyMaxX,x); bodyMaxY=Math.Max(bodyMaxY,y); count++;
          }
        }
        if(count==0) throw new Exception("Quadro vazio: "+i);
        float cx=sphere?(bodyMinX+bodyMaxX)/2f:bodyMaxX-(bodyMaxX-bodyMinX)*0.18f;
        float cy=(bodyMinY+bodyMaxY)/2f;
        centers[i]=new PointF(cx,cy); float ax=sphere?32:48;
        scale=Math.Min(scale,(ax-3)/Math.Max(1,cx-minX));
        scale=Math.Min(scale,(61-ax)/Math.Max(1,maxX-cx));
        scale=Math.Min(scale,29f/Math.Max(1,cy-minY));
        scale=Math.Min(scale,29f/Math.Max(1,maxY-cy));
      }
      using(var output=new Bitmap(256,128,PixelFormat.Format32bppArgb)) {
        using(var g=Graphics.FromImage(output)) {
          g.InterpolationMode=InterpolationMode.NearestNeighbor; g.PixelOffsetMode=PixelOffsetMode.Half;
          g.CompositingMode=CompositingMode.SourceCopy;
          for(int i=0;i<8;i++) {
            var s=frames[i];var c=centers[i];int dx=i%4*64,dy=i/4*64;
            g.SetClip(new Rectangle(dx,dy,64,64));
            g.DrawImage(source,new RectangleF(dx+(sphere?32:48)-(c.X-s.X)*scale,dy+32-(c.Y-s.Y)*scale,s.Width*scale,s.Height*scale),s,GraphicsUnit.Pixel);
          }
        }
        for(int i=0;i<8;i++) {
          int count=0; for(int y=0;y<64;y++) for(int x=0;x<64;x++) {
            var c=output.GetPixel(i%4*64+x,i/4*64+y); if(c.A==0) continue; count++;
            if(x==0||y==0||x==63||y==63) throw new Exception("Sem folga: "+i);
          }
          if(count==0) throw new Exception("Quadro vazio: "+i);
        }
        output.Save(outputPath,ImageFormat.Png);
      }
      Console.WriteLine(outputPath+": 256x128, oito quadros com alpha e folga");
    }
  }
}
'@
foreach($name in @('mizurappa','suiryuudan')) {
  [SuitonSheet]::Prepare((Join-Path $ProjectRoot "docs/arte/jutsus/suiton/projectile-$name-source.png"),(Join-Path $ProjectRoot "src/art/effects/projectile-$name.png"),$false)
}
[SuitonSheet]::Prepare((Join-Path $ProjectRoot 'docs/arte/jutsus/suiton/effect-suirou-source.png'),(Join-Path $ProjectRoot 'src/art/effects/effect-suirou.png'),$true)
