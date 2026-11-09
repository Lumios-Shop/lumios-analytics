# Diagnostic du jeton Meta : identité, permissions accordées, comptes pub accessibles (n'affiche jamais le jeton)
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$cfg = @{}
Get-Content (Join-Path $PSScriptRoot ".env") | ForEach-Object {
  $l = $_.Trim(); if ($l -and -not $l.StartsWith("#") -and $l.Contains("=")) { $p = $l.Split("=", 2); $cfg[$p[0].Trim()] = $p[1].Trim().Trim('"') }
}
$t = $cfg["META_ACCESS_TOKEN"]; $v = if ($cfg["META_API_VERSION"]) { $cfg["META_API_VERSION"] } else { "v23.0" }
Write-Host ("Longueur jeton : " + $t.Length + " | début : " + $t.Substring(0, [Math]::Min(4, $t.Length)) + "...")
function Get-Body($u) {
  try { return (Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 60).Content }
  catch {
    if ($_.ErrorDetails.Message) { return $_.ErrorDetails.Message }
    if ($_.Exception.Response) { return (New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() }
    return $_.Exception.Message
  }
}
$b = "https://graph.facebook.com/$v"
Write-Host "`n/me :";            Write-Host (Get-Body ($b + "/me?fields=id,name&access_token=" + $t))
Write-Host "`n/me/permissions :"; Write-Host (Get-Body ($b + "/me/permissions?access_token=" + $t))
Write-Host "`n/me/adaccounts :";  Write-Host (Get-Body ($b + "/me/adaccounts?fields=id,name,account_status&limit=50&access_token=" + $t))
Write-Host "`nCompte cible :";    Write-Host (Get-Body ($b + "/" + $cfg["META_AD_ACCOUNT_ID"] + "?fields=id,name&access_token=" + $t))
Write-Host "`nCampagnes :";       Write-Host (Get-Body ($b + "/" + $cfg["META_AD_ACCOUNT_ID"] + "/campaigns?fields=id,name,effective_status,objective,start_time,stop_time&limit=100&access_token=" + $t))
