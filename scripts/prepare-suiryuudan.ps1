# O dragão é uma sequência de ataque: não recentralizar nem redimensionar cada pose separadamente.
param([string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
public static class DragonAttackSheet {
  public static void Prepare(string input, string outputPath) {
    using(var source=new Bitmap(input)) using(var output=new Bitmap(384,192,PixelFormat.Format32bppArgb)) {
      // Uma pose pode atravessar a grade da IA: pertence inteira à casa onde tem mais pixels.
      // Usa os oito corpos principais, deixando de fora ruído solto; nunca corta um focinho na grade.
      int w=source.Width,h=source.Height,n=w*h;
      var colors=new Color[n];var labels=new int[n];var queue=new int[n];
      for(int y=0;y<h;y++) for(int x=0;x<w;x++) colors[y*w+x]=source.GetPixel(x,y);
      var ids=new int[8];var counts=new int[8];var boxes=new Rectangle[8];int label=0;
      for(int start=0;start<n;start++) {
        if(labels[start]!=0||colors[start].A==0) continue;
        label++;int read=0,write=1;queue[0]=start;labels[start]=label;
        var votes=new int[8];int minX=w,minY=h,maxX=0,maxY=0;
        while(read<write) {
          int q=queue[read++],x=q%w,y=q/w;
          minX=Math.Min(minX,x);maxX=Math.Max(maxX,x);minY=Math.Min(minY,y);maxY=Math.Max(maxY,y);
          votes[Math.Min(1,y*2/h)*4+Math.Min(3,x*4/w)]++;
          for(int dy=-1;dy<=1;dy++) for(int dx=-1;dx<=1;dx++) {
            int xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h) continue;
            int k=yy*w+xx;if(labels[k]!=0||colors[k].A==0) continue;
            labels[k]=label;queue[write++]=k;
          }
        }
        int owner=0;for(int i=1;i<8;i++) if(votes[i]>votes[owner]) owner=i;
        if(write>counts[owner]) { ids[owner]=label;counts[owner]=write;boxes[owner]=Rectangle.FromLTRB(minX,minY,maxX+1,maxY+1); }
      }
      var pivots=new PointF[8];float scale=1;
      for(int i=0;i<8;i++) {
        if(counts[i]<100) throw new Exception("Pose principal ausente: "+i);
        var b=boxes[i];double sx=0;int count=0,baseY=b.Top;
        for(int y=b.Top;y<b.Bottom;y++) for(int x=b.Left;x<b.Right;x++)
          if(labels[y*w+x]==ids[i]&&colors[y*w+x].A>=96) baseY=Math.Max(baseY,y);
        for(int y=Math.Max(b.Top,baseY-Math.Max(2,b.Height/20));y<=baseY;y++) for(int x=b.Left;x<b.Right;x++) {
          int k=y*w+x;if(labels[k]!=ids[i]||colors[k].A<96) continue;sx+=x;count++;
        }
        float cx=count>0?(float)(sx/count):(b.Left+b.Right)/2f,cy=baseY;
        pivots[i]=new PointF(cx,cy);float ax=i<5?24:72;
        scale=Math.Min(scale,(ax-3)/Math.Max(1,cx-b.Left));
        scale=Math.Min(scale,(93-ax)/Math.Max(1,b.Right-cx));
        scale=Math.Min(scale,75f/Math.Max(1,cy-b.Top));
      }
      using(var g=Graphics.FromImage(output)) {
        g.InterpolationMode=InterpolationMode.NearestNeighbor;
        g.PixelOffsetMode=PixelOffsetMode.Half;
        g.CompositingMode=CompositingMode.SourceCopy;
        for(int i=0;i<8;i++) {
          g.SetClip(new Rectangle(i%4*96,i/4*96,96,96));
          var b=boxes[i];var p=pivots[i];
          using(var body=new Bitmap(b.Width,b.Height,PixelFormat.Format32bppArgb)) {
            for(int y=b.Top;y<b.Bottom;y++) for(int x=b.Left;x<b.Right;x++)
              if(labels[y*w+x]==ids[i]) body.SetPixel(x-b.Left,y-b.Top,colors[y*w+x]);
            g.DrawImage(body,new RectangleF(i%4*96+(i<5?24:72)-(p.X-b.Left)*scale,
              i/4*96+78.72f-(p.Y-b.Top)*scale,b.Width*scale,b.Height*scale),
              new RectangleF(0,0,b.Width,b.Height),GraphicsUnit.Pixel);
          }
        }
      }
      for(int i=0;i<8;i++) {
        int visible=0;
        for(int y=0;y<96;y++) for(int x=0;x<96;x++) {
          var p=output.GetPixel(i%4*96+x,i/4*96+y);
          if(p.A==0) continue;
          visible++;
          if(x==0||y==0||x==95||y==95) throw new Exception("Quadro sem folga: "+i);
        }
        if(visible==0) throw new Exception("Quadro vazio: "+i);
      }
      output.Save(outputPath,ImageFormat.Png);
      Console.WriteLine("Dragao: 384x192, oito quadros de ataque com folga e alpha.");
    }
  }
}
'@
[DragonAttackSheet]::Prepare((Join-Path $ProjectRoot 'docs/arte/jutsus/suiton/projectile-suiryuudan-v2-source.png'),(Join-Path $ProjectRoot 'src/art/effects/projectile-suiryuudan-v2.png'))
