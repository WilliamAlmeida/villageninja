# Normaliza a grade sem recentralizar cada quadro: preserva formação e dissipação.
param([string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$dir = Join-Path $ProjectRoot 'docs/arte/jutsus/clones-edo-cura'
foreach ($kind in @('smoke-poof','edo-coffin','shousen-palm')) {
 $version = 'v1'
 $src = [Drawing.Bitmap]::new((Join-Path $dir "$kind-source-$version.png"))
 $dst = [Drawing.Bitmap]::new(512,256,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
 try {
  for ($i=0;$i -lt 8;$i++) {
   for ($y=0;$y -lt 128;$y++) { for ($x=0;$x -lt 128;$x++) {
    $sx=[Math]::Min($src.Width-1,[int][Math]::Floor((($i%4)+($x+.5)/128)*$src.Width/4))
    $sy=[Math]::Min($src.Height-1,[int][Math]::Floor(([Math]::Floor($i/4)+($y+.5)/128)*$src.Height/2))
    $dst.SetPixel(($i%4)*128+$x,[Math]::Floor($i/4)*128+$y,$src.GetPixel($sx,$sy))
   }}
  }
  $dst.Save((Join-Path $dir "effect-$kind-$version.png"),[Drawing.Imaging.ImageFormat]::Png)
  Write-Output "$kind : 512x256 RGBA, 4x2, escala uniforme e alpha preservado"
 } finally { $src.Dispose(); $dst.Dispose() }
}
