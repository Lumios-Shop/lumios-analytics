# Lumios Analytics - Script de démarrage automatique
$nodeDir = "c:\David\AI\node\node-v20.15.0-win-x64"
$env:PATH = "$nodeDir;" + $env:PATH

# 1. Vérifier si le serveur backend Express (port 3001) tourne déjà
$backendConn = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue
if (-not $backendConn) {
    Write-Host "[1/3] Demarrage du serveur backend Express (port 3001)..." -ForegroundColor Cyan
    Start-Process -FilePath "$nodeDir\node.exe" -ArgumentList "src/index.js" -WorkingDirectory "c:\David\AI\Lumios Analytics\server" -WindowStyle Hidden
    Start-Sleep -Seconds 2
} else {
    Write-Host "[1/3] Serveur backend deja actif sur http://localhost:3001" -ForegroundColor Green
}

# 2. Vérifier si le serveur Vite dev (port 5173) tourne déjà
$viteConn = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if (-not $viteConn) {
    Write-Host "[2/3] Demarrage du frontend Vite (port 5173)..." -ForegroundColor Cyan
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev -- --host" -WorkingDirectory "c:\David\AI\Lumios Analytics\client" -WindowStyle Hidden
    Start-Sleep -Seconds 2
} else {
    Write-Host "[2/3] Frontend Vite deja actif sur http://localhost:5173" -ForegroundColor Green
}

# 3. Vérifier si cloudflared tourne
$cfProc = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
if (-not $cfProc) {
    Write-Host "[3/3] Demarrage du tunnel Cloudflare..." -ForegroundColor Cyan
    Start-Process -FilePath "c:\David\AI\cloudflared.exe" -ArgumentList "tunnel --url http://localhost:5173" -WorkingDirectory "c:\David\AI" -WindowStyle Hidden
} else {
    Write-Host "[3/3] Tunnel Cloudflare deja actif" -ForegroundColor Green
}

# Ouvrir directement le tableau de bord local dans le navigateur par défaut
Start-Sleep -Seconds 1
Start-Process "http://localhost:5173"
