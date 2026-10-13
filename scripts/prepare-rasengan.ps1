# Prepara a folha compartilhada dos dois Rasengan; não gera uma segunda arte para o Ōdama.
param([string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
public static class RasenganSheet {
 public static void Prepare(string input,string output) {
  using(var src=new Bitmap(input)) using(var dst=new Bitmap(256,128,PixelFormat.Format32bppArgb)) {
   var images=new Bitmap[8];var centers=new PointF[8];float scale=1;
   try {
    for(int i=0;i<8;i++) {
     int x0=i%4*src.Width/4,x1=(i%4+1)*src.Width/4,y0=i/4*src.Height/2,y1=(i/4+1)*src.Height/2;
     int w=x1-x0,h=y1-y0,n=w*h;var colors=new Color[n];var labels=new int[n];var queue=new int[n];
     for(int y=0;y<h;y++)for(int x=0;x<w;x++)colors[y*w+x]=src.GetPixel(x0+x,y0+y);
     int label=0,best=0,bestCount=0;Rectangle bounds=new Rectangle();
     for(int start=0;start<n;start++) {
      if(labels[start]!=0||colors[start].A<24)continue;
      label++;int read=0,write=1;queue[0]=start;labels[start]=label;int lx=w,ly=h,rx=0,ry=0;
      while(read<write) {
       int p=queue[read++],x=p%w,y=p/w;lx=Math.Min(lx,x);ly=Math.Min(ly,y);rx=Math.Max(rx,x);ry=Math.Max(ry,y);
       for(int dy=-1;dy<=1;dy++)for(int dx=-1;dx<=1;dx++) {
        int xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;int k=yy*w+xx;
        if(labels[k]!=0||colors[k].A<24)continue;labels[k]=label;queue[write++]=k;
       }
      }
      if(write>bestCount){best=label;bestCount=write;bounds=Rectangle.FromLTRB(lx,ly,rx+1,ry+1);}
     }
     if(bestCount<100)throw new Exception("Esfera ausente no quadro "+i);
     var mask=new Bitmap(w,h,PixelFormat.Format32bppArgb);images[i]=mask;
     for(int y=0;y<h;y++)for(int x=0;x<w;x++)if(labels[y*w+x]==best)mask.SetPixel(x,y,colors[y*w+x]);
     centers[i]=new PointF((bounds.Left+bounds.Right)/2f,(bounds.Top+bounds.Bottom)/2f);
     scale=Math.Min(scale,48f/Math.Max(bounds.Width,bounds.Height));
    }
    using(var g=Graphics.FromImage(dst)) {
     g.InterpolationMode=InterpolationMode.NearestNeighbor;g.PixelOffsetMode=PixelOffsetMode.Half;g.CompositingMode=CompositingMode.SourceCopy;
     for(int i=0;i<8;i++) {
      var img=images[i];var p=centers[i];int x=i%4*64,y=i/4*64;g.SetClip(new Rectangle(x,y,64,64));
      g.DrawImage(img,new RectangleF(x+32-p.X*scale,y+32-p.Y*scale,img.Width*scale,img.Height*scale),new RectangleF(0,0,img.Width,img.Height),GraphicsUnit.Pixel);
     }
    }
    for(int i=0;i<8;i++) {
     int count=0;for(int y=0;y<64;y++)for(int x=0;x<64;x++) {
      if(dst.GetPixel(i%4*64+x,i/4*64+y).A==0)continue;count++;
      if(x==0||y==0||x==63||y==63)throw new Exception("Esfera cortada no quadro "+i);
     }
     if(count==0)throw new Exception("Quadro vazio "+i);
    }
    dst.Save(output,ImageFormat.Png);Console.WriteLine("Rasengan: 256x128, 8 quadros, centro (32,32), alpha e folga conferidos.");
   } finally {foreach(var img in images)if(img!=null)img.Dispose();}
  }
 }
}
'@
[RasenganSheet]::Prepare((Join-Path $ProjectRoot 'docs/arte/jutsus/rasengan/effect-rasengan-v1-source.png'),(Join-Path $ProjectRoot 'src/art/effects/effect-rasengan-v1.png'))
