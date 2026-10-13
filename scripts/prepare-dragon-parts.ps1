param([string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
public static class DragonParts {
 public static void Prepare(string input,string path,string part) {
  using(var src=new Bitmap(input)) using(var dst=new Bitmap(256,128,PixelFormat.Format32bppArgb)) {
   int w=src.Width,h=src.Height,n=w*h;var colors=new Color[n];var labels=new int[n];
   for(int y=0;y<h;y++) for(int x=0;x<w;x++) colors[y*w+x]=src.GetPixel(x,y);
   var ids=new int[8];var counts=new int[8];var boxes=new Rectangle[8];var pivots=new PointF[8];float scale=1;
   if(part!="body") {
    var queue=new int[n];int label=0;
    for(int start=0;start<n;start++) {
     if(labels[start]!=0||colors[start].A==0)continue;
     label++;int read=0,write=1;queue[0]=start;labels[start]=label;var votes=new int[8];
     int lx=w,ly=h,rx=0,ry=0;
     while(read<write) {
      int q=queue[read++],x=q%w,y=q/w;lx=Math.Min(lx,x);ly=Math.Min(ly,y);rx=Math.Max(rx,x);ry=Math.Max(ry,y);
      votes[Math.Min(1,y*2/h)*4+Math.Min(3,x*4/w)]++;
      for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++) {
       int xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;int k=yy*w+xx;
       if(labels[k]!=0||colors[k].A==0)continue;labels[k]=label;queue[write++]=k;
      }
     }
     int owner=0;for(int i=1;i<8;i++)if(votes[i]>votes[owner])owner=i;
     if(write>counts[owner]){ids[owner]=label;counts[owner]=write;boxes[owner]=Rectangle.FromLTRB(lx,ly,rx+1,ry+1);}
    }
    for(int i=0;i<8;i++) {
     var b=boxes[i];if(counts[i]<100)throw new Exception("Parte vazia: "+part+" "+i);
     float cx,cy;
     if(part=="head") {
      cx=b.Right-b.Width*0.14f;double sumY=0;int count=0;
      for(int y=b.Top;y<b.Bottom;y++)for(int x=b.Right-b.Width/4;x<b.Right;x++)
       if(labels[y*w+x]==ids[i]&&colors[y*w+x].A>=96){sumY+=y;count++;}
      cy=count>0?(float)(sumY/count):(b.Top+b.Bottom)/2f;
      scale=Math.Min(scale,45f/Math.Max(1,cx-b.Left));scale=Math.Min(scale,13f/Math.Max(1,b.Right-cx));
      scale=Math.Min(scale,29f/Math.Max(1,cy-b.Top));scale=Math.Min(scale,29f/Math.Max(1,b.Bottom-cy));
     } else {
      int bottom=b.Top;for(int y=b.Top;y<b.Bottom;y++)for(int x=b.Left;x<b.Right;x++)
       if(labels[y*w+x]==ids[i]&&colors[y*w+x].A>=96)bottom=Math.Max(bottom,y);
      double sumX=0;int count=0;
      for(int y=Math.Max(b.Top,bottom-b.Height/10);y<=bottom;y++)for(int x=b.Left;x<b.Right;x++)
       if(labels[y*w+x]==ids[i]&&colors[y*w+x].A>=96){sumX+=x;count++;}
      cx=count>0?(float)(sumX/count):(b.Left+b.Right)/2f;cy=bottom;
      scale=Math.Min(scale,40f/Math.Max(1,cy-b.Top));scale=Math.Min(scale,28f/Math.Max(1,cx-b.Left));
      scale=Math.Min(scale,28f/Math.Max(1,b.Right-cx));scale=Math.Min(scale,11f/Math.Max(1,b.Bottom-cy));
     }
     pivots[i]=new PointF(cx,cy);
    }
   }
   using(var g=Graphics.FromImage(dst)) {
    g.InterpolationMode=InterpolationMode.NearestNeighbor;g.PixelOffsetMode=PixelOffsetMode.Half;g.CompositingMode=CompositingMode.SourceCopy;
    for(int i=0;i<8;i++) {
     int dx=i%4*64,dy=i/4*64;g.SetClip(new Rectangle(dx,dy,64,64));
     if(part=="body") {
      int x0=i%4*w/4,x1=(i%4+1)*w/4,y0=i/4*h/2,y1=(i/4+1)*h/2,top=y1,bottom=y0;
      for(int y=y0;y<y1;y++){int count=0;for(int x=x0;x<x1;x++)if(colors[y*w+x].A>=96)count++;
       if(count>(x1-x0)*0.35){top=Math.Min(top,y);bottom=Math.Max(bottom,y);}}
      if(top>=bottom)throw new Exception("Faixa do corpo ausente: "+i);
      g.DrawImage(src,new Rectangle(dx,dy+21,64,22),new Rectangle(x0+2,top,x1-x0-4,bottom-top+1),GraphicsUnit.Pixel);
     } else {
      var b=boxes[i];var p=pivots[i];using(var mask=new Bitmap(b.Width,b.Height,PixelFormat.Format32bppArgb)) {
       for(int y=b.Top;y<b.Bottom;y++)for(int x=b.Left;x<b.Right;x++)if(labels[y*w+x]==ids[i])mask.SetPixel(x-b.Left,y-b.Top,colors[y*w+x]);
       g.DrawImage(mask,new RectangleF(dx+(part=="head"?48:32)-(p.X-b.Left)*scale,dy+(part=="head"?32:50)-(p.Y-b.Top)*scale,b.Width*scale,b.Height*scale),
        new RectangleF(0,0,b.Width,b.Height),GraphicsUnit.Pixel);
      }
     }
    }
   }
   for(int i=0;i<8;i++){int count=0;for(int y=0;y<64;y++)for(int x=0;x<64;x++) {
    if(dst.GetPixel(i%4*64+x,i/4*64+y).A==0)continue;count++;
    if(y==0||y==63||(part!="body"&&(x==0||x==63)))throw new Exception("Parte sem folga: "+part+" "+i);
   }if(count==0)throw new Exception("Quadro vazio: "+i);}
   dst.Save(path,ImageFormat.Png);Console.WriteLine(part+": 256x128, oito quadros e alpha.");
  }
 }
}
'@
foreach($part in @('head','body','origin')) {
 [DragonParts]::Prepare((Join-Path $ProjectRoot "docs/arte/jutsus/suiton/modular/$part-source.png"),(Join-Path $ProjectRoot "src/art/effects/effect-suiryuudan-$part.png"),$part)
}
