# Efiko icon generator.
# Source: full horizontal lockup (owl + "Efiko" + book + tagline). Produces:
#   logo.png            - full lockup, downscaled (header)
#   icon-512/192.png    - square owl mark (PWA app icon)
#   icon-maskable-512   - owl on white, padded (Android safe zone)
#   apple-touch-icon    - 180px square owl
#   favicon.png         - 64px square owl
param(
  [string]$Src = 'C:\Users\Dell\Downloads\Efiko Icon.png',
  [string]$OutDir = 'C:\Users\Dell\Downloads\Efiko PWA\public'
)

Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile($Src)
$W = $img.Width; $H = $img.Height

# Detect the owl bounding box: scan only the LEFT region (exclude the wordmark/book)
# and the UPPER region (exclude the bottom tagline line).
$scanMaxX = [int]($W * 0.31)
$scanMaxY = [int]($H * 0.74)
$stride = 4
$minX = $W; $minY = $H; $maxX = 0; $maxY = 0
for ($y = 0; $y -lt $scanMaxY; $y += $stride) {
  for ($x = 0; $x -lt $scanMaxX; $x += $stride) {
    $p = $img.GetPixel($x, $y)
    $isBg = ($p.A -lt 20) -or ($p.R -gt 244 -and $p.G -gt 244 -and $p.B -gt 244)
    if (-not $isBg) {
      if ($x -lt $minX) { $minX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
"owl bbox: x=$minX..$maxX y=$minY..$maxY"

$bw = $maxX - $minX; $bh = $maxY - $minY
"owl size: ${bw}x${bh}"

# Composite ONLY the owl bbox, centered, onto a square canvas — so the book corner,
# wordmark, and tagline can never leak into the icon.
function Save-Owl([int]$size, [string]$path, [bool]$mask) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  if ($mask) { $g.Clear([System.Drawing.Color]::White) }
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $fill = if ($mask) { 0.62 } else { 0.92 }   # maskable needs extra safe-zone padding
  $scale = ($size * $fill) / [Math]::Max($bw, $bh)
  $dw = [int]($bw * $scale); $dh = [int]($bh * $scale)
  $dx = [int](($size - $dw) / 2); $dy = [int](($size - $dh) / 2)
  $dest = New-Object System.Drawing.Rectangle($dx, $dy, $dw, $dh)
  $g.DrawImage($img, $dest, $minX, $minY, $bw, $bh, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
  "wrote $path"
}

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force $OutDir | Out-Null }
Save-Owl 512 (Join-Path $OutDir 'icon-512.png') $false
Save-Owl 192 (Join-Path $OutDir 'icon-192.png') $false
Save-Owl 180 (Join-Path $OutDir 'apple-touch-icon.png') $false
Save-Owl 64  (Join-Path $OutDir 'favicon.png') $false
Save-Owl 512 (Join-Path $OutDir 'icon-maskable-512.png') $true

# Full lockup for the header, downscaled hard (never ship the 1536px source).
$logoW = 520
$logoH = [int]($img.Height * $logoW / $img.Width)
$logo = New-Object System.Drawing.Bitmap($logoW, $logoH)
$lg = [System.Drawing.Graphics]::FromImage($logo)
$lg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$lg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$lg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$lg.DrawImage($img, 0, 0, $logoW, $logoH)
$lg.Dispose()
$logo.Save((Join-Path $OutDir 'logo.png'), [System.Drawing.Imaging.ImageFormat]::Png); $logo.Dispose()
"wrote logo.png ($logoW x $logoH)"
$img.Dispose()
"done"
