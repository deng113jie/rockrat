# Research Agent UI - Windows Installer
# Run with: powershell -ExecutionPolicy Bypass -File install.ps1

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host "`n>>> $msg" -ForegroundColor Cyan }
function Write-OK($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }
function Write-Skip($msg)  { Write-Host "    [SKIP] $msg - already installed" -ForegroundColor Yellow }
function Write-Fail($msg)  { Write-Host "    [FAIL] $msg" -ForegroundColor Red }

function Refresh-Path {
    $machinePath = [Environment]::GetEnvironmentVariable("PATH", "Machine")
    $userPath    = [Environment]::GetEnvironmentVariable("PATH", "User")
    $env:PATH    = "$machinePath;$userPath"
}

function Test-Command($cmd) {
    $null = Get-Command $cmd -ErrorAction SilentlyContinue
    return $?
}

function Install-WithWinget($packageId, $name) {
    Write-Step "Checking $name..."
    # Ensure winget is available
    if (-not (Test-Command "winget")) {
        Write-Fail "winget is not available. Please install $name manually or update your Windows to a version that includes App Installer."
        return $false
    }
    winget install --id $packageId --accept-source-agreements --accept-package-agreements
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Failed to install $name via winget. Please install it manually."
        return $false
    }
    Refresh-Path
    Write-OK "$name installed"
    return $true
}

# ── 1. Git ──────────────────────────────────────────────────────────────────────
Write-Step "Checking Git..."
if (Test-Command "git") {
    Write-Skip "Git ($(git --version))"
} else {
    if (-not (Install-WithWinget "Git.Git" "Git")) { exit 1 }
}

# ── 2. Python ───────────────────────────────────────────────────────────────────
Write-Step "Checking Python..."
if (Test-Command "python") {
    $pyVer = python --version 2>&1
    Write-Skip "Python ($pyVer)"
} else {
    if (-not (Install-WithWinget "Python.Python.3.12" "Python 3.12")) { exit 1 }
}

# ── 3. Node.js ──────────────────────────────────────────────────────────────────
Write-Step "Checking Node.js..."
if (Test-Command "node") {
    Write-Skip "Node.js ($(node --version))"
} else {
    if (-not (Install-WithWinget "OpenJS.NodeJS.LTS" "Node.js LTS")) { exit 1 }
}

# Verify npm is available after Node.js install
if (-not (Test-Command "npm")) {
    Write-Fail "npm not found after Node.js install. Please restart your terminal and run this script again."
    exit 1
}

# ── 4. Claude Code CLI ─────────────────────────────────────────────────────────
Write-Step "Checking Claude Code CLI..."
if (Test-Command "claude") {
    Write-Skip "Claude Code ($(claude --version 2>&1))"
} else {
    Write-Host "    Installing Claude Code CLI via npm..."
    npm install -g @anthropic-ai/claude-code
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Failed to install Claude Code CLI. Please run: npm install -g @anthropic-ai/claude-code"
        exit 1
    }
    Refresh-Path
    Write-OK "Claude Code CLI installed"
}

# ── 5. npm install ──────────────────────────────────────────────────────────────
Write-Step "Installing project dependencies..."
$projectDir = Split-Path -Parent $PSScriptRoot
Push-Location $projectDir
try {
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "npm install failed"
        exit 1
    }
    Write-OK "Dependencies installed"
} finally {
    Pop-Location
}

# ── 6. API configuration ───────────────────────────────────────────────────────
$envFile = Join-Path $projectDir ".env"
$envLines = @()

# Load existing .env if present
if (Test-Path $envFile) {
    $envLines = @(Get-Content $envFile)
    Write-Step "Existing .env found. Reconfiguring..."
} else {
    Write-Step "Setting up API configuration..."
}

# API endpoint (optional change)
$defaultEndpoint = "https://api.deepseek.com/anthropic"
# Try to read current value from existing .env
foreach ($line in $envLines) {
    if ($line -match '^ANTHROPIC_BASE_URL=(.+)$') {
        $defaultEndpoint = $Matches[1].Trim('"', "'", ' ')
    }
}
Write-Host "    Current API endpoint: $defaultEndpoint" -ForegroundColor Gray
$changeEndpoint = Read-Host "    Change API endpoint? (y/n)"
if ($changeEndpoint -eq "y") {
    $newEndpoint = Read-Host "    Enter new API endpoint"
    if ($newEndpoint) { $defaultEndpoint = $newEndpoint }
}

# API key (required)
$apiKey = ""
while (-not $apiKey) {
    $apiKey = Read-Host "    Enter your API key (required)"
    if (-not $apiKey) {
        Write-Host "    API key is required. Please try again." -ForegroundColor Red
    }
}

# Write .env
@(
    "ANTHROPIC_BASE_URL=`"$defaultEndpoint`""
    "ANTHROPIC_API_KEY=$apiKey"
) | Out-File -FilePath $envFile -Encoding UTF8
Write-OK ".env file saved"

# ── Done ────────────────────────────────────────────────────────────────────────
Write-Host "`n========================================" -ForegroundColor Green
Write-Host " Installation complete!" -ForegroundColor Green
Write-Host " To start the server, run:" -ForegroundColor Green
Write-Host "   cd $projectDir" -ForegroundColor White
Write-Host "   npm start" -ForegroundColor White
Write-Host " Then open http://localhost:3030 in your browser." -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

$startNow = Read-Host "Start the server now? (y/n)"
if ($startNow -eq "y") {
    Push-Location $projectDir
    Start-Process "http://localhost:3030"
    npm start
    Pop-Location
}
