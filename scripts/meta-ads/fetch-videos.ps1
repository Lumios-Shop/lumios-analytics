# Récupère durée, miniature HD et fichier vidéo des créas vidéo (dernier dossier data)
param([int]$MaxMB = 60)
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$cfg = @{}
Get-Content (Join-Path $PSScriptRoot ".env") | % { $l = $_.Trim(); if ($l -and -not $l.StartsWith("#") -and $l.Contains("=")) { $p = $l.Split("=", 2); $cfg[$p[0].Trim()] = $p[1].Trim().Trim('"') } }
$t = $cfg["META_ACCESS_TOKEN"]; $v = $cfg["META_API_VERSION"]
$dir = Get-ChildItem (Join-Path $PSScriptRoot "data") -Directory | sort Name | select -Last 1
$vdir = Join-Path $dir.FullName "videos"; New-Item -ItemType Directory -Force $vdir | Out-Null
$ads = @((Get-Content (Join-Path $dir.FullName "ads_creatives.json") -Raw -Encoding UTF8 | ConvertFrom-Json) | % { $_ })
$meta = @()
foreach ($ad in $ads) {
  $ids = @()
  if ($ad.creative.video_id) { $ids += [string]$ad.creative.video_id }
  if ($ad.creative.asset_feed_spec.videos) { $ids += @($ad.creative.asset_feed_spec.videos | % { [string]$_.video_id }) }
  $ids = $ids | ? { $_ } | select -Unique
  foreach ($vid in $ids) {
    $info = $null; $err = $null
    try { $info = Invoke-RestMethod -Uri ("https://graph.facebook.com/$v/" + $vid + "?fields=id,length,source,picture,title,description&access_token=" + $t) -TimeoutSec 60 }
    catch { $err = $_.ErrorDetails.Message; if (-not $err) { $err = $_.Exception.Message } }
    $file = $null
    if ($info.source) {
      $file = Join-Path $vdir ($ad.id + "_" + $vid + ".mp4")
      try { Invoke-WebRequest -Uri $info.source -OutFile $file -UseBasicParsing -TimeoutSec 300; if ((Get-Item $file).Length -gt $MaxMB * 1MB) { Remove-Item $file; $file = "trop gros" } } catch { $file = "échec téléchargement" }
    }
    if ($info.picture) { try { Invoke-WebRequest -Uri $info.picture -OutFile (Join-Path $vdir ($ad.id + "_" + $vid + ".jpg")) -UseBasicParsing -TimeoutSec 60 } catch {} }
    $meta += [pscustomobject]@{ ad_id = $ad.id; ad_name = $ad.name; video_id = $vid; length = $info.length; file = $file; error = $err }
    Write-Host ("{0} | {1} | {2}s | {3} {4}" -f $ad.name, $vid, $info.length, $file, $err)
  }
}
ConvertTo-Json -InputObject $meta -Depth 5 | Out-File (Join-Path $dir.FullName "videos.json") -Encoding utf8
