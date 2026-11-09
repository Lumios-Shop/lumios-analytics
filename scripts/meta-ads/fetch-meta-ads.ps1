<#
  Extraction des données Meta (Facebook/Instagram) Ads via l'API Marketing.
  Lit la config dans scripts/meta-ads/.env :
    META_ACCESS_TOKEN=...      (jeton avec la permission ads_read)
    META_AD_ACCOUNT_ID=act_... (ou juste le numéro)
    META_API_VERSION=v23.0     (optionnel)

  Usage :
    powershell -ExecutionPolicy Bypass -File scripts/meta-ads/fetch-meta-ads.ps1
    powershell -ExecutionPolicy Bypass -File scripts/meta-ads/fetch-meta-ads.ps1 -DatePreset last_30d
    powershell -ExecutionPolicy Bypass -File scripts/meta-ads/fetch-meta-ads.ps1 -Since 2026-08-01 -Until 2026-11-07
#>
param(
  [string]$DatePreset = "last_90d",
  [string]$Since,
  [string]$Until,
  [int]$TopCreatives = 40,
  [string]$CampaignId,
  [int]$AdTimeIncrement = 7
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = $PSScriptRoot
$envFile = Join-Path $root ".env"
if (-not (Test-Path $envFile)) { throw "Fichier .env introuvable : $envFile" }

$cfg = @{}
Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
    $parts = $line.Split("=", 2)
    $cfg[$parts[0].Trim()] = $parts[1].Trim().Trim('"')
  }
}

$token = $cfg["META_ACCESS_TOKEN"]
$acct  = $cfg["META_AD_ACCOUNT_ID"]
$ver   = if ($cfg["META_API_VERSION"]) { $cfg["META_API_VERSION"] } else { "v23.0" }
if (-not $token -or $token -like "COLLE*") { throw "META_ACCESS_TOKEN manquant dans .env" }
if (-not $acct  -or $acct  -like "act_XXX*") { throw "META_AD_ACCOUNT_ID manquant dans .env" }
if (-not $acct.StartsWith("act_")) { $acct = "act_" + $acct }

$base = "https://graph.facebook.com/" + $ver
$out  = Join-Path $root ("data\" + (Get-Date -Format "yyyyMMdd_HHmm"))
$imgDir = Join-Path $out "creatives"
New-Item -ItemType Directory -Force -Path $imgDir | Out-Null

function Invoke-Graph {
  param([string]$Path, [hashtable]$Params = @{})
  $p = $Params.Clone()
  $p["access_token"] = $token
  $qs = ($p.GetEnumerator() | ForEach-Object { $_.Key + "=" + [uri]::EscapeDataString([string]$_.Value) }) -join "&"
  $url = $base + "/" + $Path + "?" + $qs
  $all = New-Object System.Collections.ArrayList
  while ($url) {
    $resp = $null
    for ($try = 1; $try -le 3; $try++) {
      try { $resp = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 180; break }
      catch {
        $msg = $_.ErrorDetails.Message
        if (-not $msg -and $_.Exception.Response) {
          try {
            $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $msg = $sr.ReadToEnd()
          } catch { }
        }
        if (-not $msg) { $msg = $_.Exception.Message }
        if ($msg -match '"code"\s*:\s*(190|200|10|100)\b') { throw ("Erreur API Meta sur '" + $Path + "' : " + $msg) }
        if ($try -eq 3) { throw ("Erreur API Meta sur '" + $Path + "' : " + $msg) }
        Start-Sleep -Seconds (5 * $try)
      }
    }
    if ($null -eq $resp.data) { return $resp }
    foreach ($row in $resp.data) { [void]$all.Add($row) }
    $url = $resp.paging.next
  }
  return ,$all.ToArray()
}

function Save-Json($obj, $name) {
  $path = Join-Path $out $name
  ConvertTo-Json -InputObject $obj -Depth 30 | Out-File -FilePath $path -Encoding utf8
  Write-Host ("  -> " + $name)
}

$node = if ($CampaignId) { $CampaignId } else { $acct }
$timeParams = @{}
if ($Since -and $Until) {
  $timeParams["time_range"] = '{"since":"' + $Since + '","until":"' + $Until + '"}'
} else {
  $timeParams["date_preset"] = $DatePreset
}

Write-Host "Compte publicitaire..."
$account = Invoke-Graph -Path $acct -Params @{ fields = "id,name,currency,timezone_name,account_status,amount_spent" }
Save-Json $account "account.json"
Write-Host ("  Compte : " + $account.name + " (" + $account.currency + ")")

Write-Host "Publicités + créas..."
$adFields = "id,name,status,effective_status,created_time,campaign_id,adset_id," +
  "creative{id,name,title,body,object_type,call_to_action_type,thumbnail_url,image_url,video_id,object_story_spec,asset_feed_spec}"
$ads = Invoke-Graph -Path ($node + "/ads") -Params @{ fields = $adFields; limit = 200; thumbnail_width = 600; thumbnail_height = 600 }
Save-Json $ads "ads_creatives.json"

Write-Host "Insights par publicité (période complète)..."
$insFields = "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,objective,optimization_goal," +
  "spend,impressions,reach,frequency,clicks,ctr,cpc,cpm,inline_link_clicks,inline_link_click_ctr,cost_per_inline_link_click," +
  "outbound_clicks,actions,action_values,cost_per_action_type,purchase_roas," +
  "video_play_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions," +
  "video_thruplay_watched_actions,video_avg_time_watched_actions," +
  "quality_ranking,engagement_rate_ranking,conversion_rate_ranking"
$p = $timeParams.Clone(); $p["level"] = "ad"; $p["fields"] = $insFields; $p["limit"] = 200
$insights = Invoke-Graph -Path ($node + "/insights") -Params $p
Save-Json $insights "insights_ads.json"

Write-Host "Insights hebdomadaires par publicité (fatigue créa)..."
$p = $timeParams.Clone(); $p["level"] = "ad"; $p["time_increment"] = $AdTimeIncrement; $p["limit"] = 200
$p["fields"] = "ad_id,ad_name,spend,impressions,reach,frequency,ctr,inline_link_click_ctr,cpm,actions,action_values,cost_per_action_type"
Save-Json (Invoke-Graph -Path ($node + "/insights") -Params $p) "insights_ads_weekly.json"

Write-Host "Insights quotidiens (compte)..."
$p = $timeParams.Clone(); $p["level"] = $(if ($CampaignId) { "campaign" } else { "account" }); $p["time_increment"] = 1; $p["limit"] = 500
$p["fields"] = "spend,impressions,reach,frequency,clicks,ctr,cpm,inline_link_clicks,actions,action_values,purchase_roas"
Save-Json (Invoke-Graph -Path ($node + "/insights") -Params $p) "insights_account_daily.json"

Write-Host "Campagnes / ensembles de pubs (structure, budgets)..."
Save-Json (Invoke-Graph -Path ($acct + "/campaigns") -Params @{ fields = "id,name,objective,status,effective_status,buying_type,daily_budget,lifetime_budget,bid_strategy,created_time"; limit = 200 }) "campaigns.json"
Save-Json (Invoke-Graph -Path ($node + "/adsets") -Params @{ fields = "id,name,campaign_id,status,effective_status,optimization_goal,billing_event,bid_strategy,daily_budget,lifetime_budget,targeting,created_time"; limit = 200 }) "adsets.json"

Write-Host "Ventilations placement et âge/sexe..."
$bFields = "campaign_name,spend,impressions,clicks,ctr,cpm,inline_link_clicks,actions,action_values,cost_per_action_type"
$p = $timeParams.Clone(); $p["level"] = "ad"; $p["fields"] = "ad_id,ad_name," + $bFields; $p["breakdowns"] = "publisher_platform,platform_position"; $p["limit"] = 500
Save-Json (Invoke-Graph -Path ($node + "/insights") -Params $p) "breakdown_ad_placement.json"
$p = $timeParams.Clone(); $p["level"] = "adset"; $p["fields"] = "adset_name," + $bFields; $p["breakdowns"] = "age,gender"; $p["limit"] = 500
Save-Json (Invoke-Graph -Path ($node + "/insights") -Params $p) "breakdown_age_gender.json"

Write-Host ("Téléchargement des visuels (top " + $TopCreatives + " par dépense)...")
$spendByAd = @{}
foreach ($r in $insights) { $spendByAd[[string]$r.ad_id] = [double]$r.spend }
$topAds = $ads | Where-Object { $spendByAd.ContainsKey([string]$_.id) } |
  Sort-Object { $spendByAd[[string]$_.id] } -Descending | Select-Object -First $TopCreatives
$n = 0
foreach ($ad in $topAds) {
  $c = $ad.creative
  $src = if ($c.image_url) { $c.image_url } else { $c.thumbnail_url }
  if (-not $src) { continue }
  try {
    Invoke-WebRequest -Uri $src -OutFile (Join-Path $imgDir ([string]$ad.id + ".jpg")) -UseBasicParsing -TimeoutSec 60
    $n++
  } catch { Write-Host ("  (visuel indisponible pour " + $ad.id + ")") }
}
Write-Host ("  " + $n + " visuels enregistrés")

Write-Host ""
Write-Host ("Terminé. Données dans : " + $out)

