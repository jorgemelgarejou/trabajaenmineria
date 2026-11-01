<#
  Arma la versión para Netlify Drop (https://app.netlify.com/drop):
  copia site/ a dist/netlify-drop/, escribe su config.js y crea dist/trabajaenmineria-netlify-drop.zip.
  Luego arrastras la carpeta o el zip a la página de Netlify Drop.

  Netlify Drop no ejecuta funciones ni el workflow, por eso:
  -GitHubRepo  "usuario/repositorio": las ofertas se leen del jobs.json que el workflow actualiza en GitHub
               (sin esto se usan las ofertas incluidas en la carpeta y hay que volver a subirla para actualizar).
  -CvApiUrl    URL de tu Worker de Cloudflare terminada en /api/cv (sin esto, el CV funciona sin IA).

  Ejemplo:
    powershell -ExecutionPolicy Bypass -File scripts\build-netlify-drop.ps1 -GitHubRepo "jorge/trabajaenmineria" -CvApiUrl "https://cv-api.jorge.workers.dev/api/cv"
#>
param(
  [string]$GitHubRepo = "",
  [string]$Branch = "main",
  [string]$CvApiUrl = ""
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root "site"
$dist = Join-Path $root "dist"
$out = Join-Path $dist "netlify-drop"
$zip = Join-Path $dist "trabajaenmineria-netlify-drop.zip"

if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Force $out | Out-Null
Copy-Item (Join-Path $src "*") $out -Recurse
# CNAME solo sirve para GitHub Pages
Remove-Item (Join-Path $out "CNAME") -ErrorAction SilentlyContinue

$jobsUrl = "data/jobs.json"
if ($GitHubRepo) { $jobsUrl = "https://raw.githubusercontent.com/$GitHubRepo/$Branch/site/data/jobs.json" }
$config = @"
// Generado por scripts/build-netlify-drop.ps1 para Netlify Drop
window.TEM_CONFIG = {
  jobsUrl: "$jobsUrl",
  cvApiUrl: "$CvApiUrl",
};
"@
[IO.File]::WriteAllText((Join-Path $out "config.js"), $config, (New-Object Text.UTF8Encoding $false))

# Zip con rutas "/" (Compress-Archive de PowerShell 5.1 usa "\" y algunos servidores no lo entienden)
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
if (Test-Path $zip) { Remove-Item $zip -Force }
$archive = [IO.Compression.ZipFile]::Open($zip, [IO.Compression.ZipArchiveMode]::Create)
try {
  Get-ChildItem $out -Recurse -File | ForEach-Object {
    $entry = $_.FullName.Substring($out.Length + 1).Replace("\", "/")
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $_.FullName, $entry, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
  }
} finally { $archive.Dispose() }

$sizeMb = [math]::Round((Get-Item $zip).Length / 1MB, 1)
Write-Host "Listo:"
Write-Host "  Carpeta: $out"
Write-Host "  Zip:     $zip ($sizeMb MB)"
Write-Host "  Ofertas: $jobsUrl"
if ($CvApiUrl) { Write-Host "  IA CV:   $CvApiUrl" } else { Write-Host "  IA CV:   desactivada (el creador y las descargas Word/PDF funcionan)" }
Write-Host "Arrastra la carpeta o el zip a https://app.netlify.com/drop"
