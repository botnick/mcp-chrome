#Requires -Version 5.1
<#
.SYNOPSIS
    Chrome MCP Server - one-shot installer for Windows.

.DESCRIPTION
    Builds the extension and native bridge, registers the native messaging host,
    and adds chrome-mcp to Claude Code.

.PARAMETER ExtensionId
    The 32-character Chrome extension ID. If omitted, you'll be prompted after build.

.PARAMETER Rebuild
    Force a clean rebuild even if artifacts exist.

.PARAMETER SkipBuild
    Skip building; only register and configure. Requires a previous build.

.EXAMPLE
    .\scripts\quick-install.ps1
    .\scripts\quick-install.ps1 -ExtensionId "abcdefghijklmnopqrstuvwxyz123456"
    .\scripts\quick-install.ps1 -Rebuild
    .\scripts\quick-install.ps1 -SkipBuild -ExtensionId "abcdef..."
#>

param(
    [string]$ExtensionId = "",
    [switch]$Rebuild,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ExtOut = Join-Path $Root "app\chrome-extension\.output\chrome-mv3"
$BridgeDist = Join-Path $Root "app\native-server\dist"
$WasmPkg = Join-Path $Root "packages\wasm-simd\pkg"
$WasmPrebuilt = Join-Path $Root "releases\chrome-extension\latest\chrome-mcp-server-extension\workers"
$ExtWorkers = Join-Path $Root "app\chrome-extension\workers"

function Write-Info  { param($Msg) Write-Host "-> $Msg" -ForegroundColor Cyan }
function Write-Ok    { param($Msg) Write-Host "[ok] $Msg" -ForegroundColor Green }
function Write-Warn  { param($Msg) Write-Host "[warn] $Msg" -ForegroundColor Yellow }
function Write-Err   { param($Msg) Write-Host "[err] $Msg" -ForegroundColor Red }

function Assert-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Write-Err "Missing required command: $Name"
        exit 1
    }
}

function Invoke-Build {
    if ($SkipBuild) {
        if (-not (Test-Path $ExtOut) -or -not (Test-Path (Join-Path $BridgeDist "cli.js"))) {
            Write-Err "-SkipBuild given but artifacts missing. Run without -SkipBuild first."
            exit 1
        }
        Write-Ok "Skipping build (-SkipBuild); using existing artifacts"
        return
    }

    if (-not $Rebuild -and (Test-Path $ExtOut) -and (Test-Path (Join-Path $BridgeDist "cli.js"))) {
        Write-Info "Build artifacts already present (use -Rebuild to force)"
        return
    }

    Write-Info "Installing workspace dependencies"
    Push-Location $Root
    try {
        pnpm install --ignore-scripts
    } finally {
        Pop-Location
    }

    if (-not (Test-Path (Join-Path $WasmPrebuilt "simd_math.js"))) {
        Write-Err "Prebuilt WASM not found at $WasmPrebuilt"
        Write-Err "You need Rust + wasm-pack to build from source. See packages/wasm-simd/BUILD.md."
        exit 1
    }

    Write-Info "Copying WASM into wasm-simd/pkg"
    New-Item -ItemType Directory -Force -Path $WasmPkg | Out-Null
    Copy-Item (Join-Path $WasmPrebuilt "simd_math.js") $WasmPkg -Force
    Copy-Item (Join-Path $WasmPrebuilt "simd_math_bg.wasm") $WasmPkg -Force

    Write-Info "Copying WASM into extension/workers"
    New-Item -ItemType Directory -Force -Path $ExtWorkers | Out-Null
    Copy-Item (Join-Path $WasmPrebuilt "simd_math.js") $ExtWorkers -Force
    Copy-Item (Join-Path $WasmPrebuilt "simd_math_bg.wasm") $ExtWorkers -Force

    Write-Info "Building shared package"
    Push-Location $Root
    try { pnpm --filter chrome-mcp-shared build } finally { Pop-Location }

    Write-Info "Building native-server (bridge)"
    Push-Location $Root
    try { pnpm --filter mcp-chrome-bridge build } finally { Pop-Location }

    Write-Info "Building Chrome extension"
    Push-Location $Root
    try { pnpm --filter chrome-mcp-server build } finally { Pop-Location }

    Write-Ok "Build complete"
    Write-Host "  Extension: $ExtOut"
    Write-Host "  Bridge:    $BridgeDist"
}

function Get-ExtensionId {
    if ($ExtensionId) { return $ExtensionId }

    Write-Host ""
    Write-Warn "No extension ID provided. Load the unpacked extension first:"
    Write-Host ""
    Write-Host "  1. Open chrome://extensions"
    Write-Host "  2. Enable Developer mode (top-right)"
    Write-Host "  3. Click 'Load unpacked' and select:"
    Write-Host "       $ExtOut"
    Write-Host "  4. Copy the 32-character extension ID"
    Write-Host ""
    $id = Read-Host "Paste the Extension ID"
    if (-not $id) {
        Write-Err "No ID entered. Aborting."
        exit 1
    }
    return $id
}

function Register-NativeHost {
    param([string]$Id)
    $cliJs = Join-Path $BridgeDist "cli.js"
    if (-not (Test-Path $cliJs)) {
        Write-Err "Bridge not built. Run without -SkipBuild."
        exit 1
    }
    Write-Info "Registering native messaging host for $Id"
    node $cliJs register --extension-id $Id
    Write-Ok "Native messaging host registered"
}

function Add-ClaudeMcp {
    if (-not (Get-Command "claude" -ErrorAction SilentlyContinue)) {
        Write-Warn "Claude Code CLI not found on PATH - skipping mcp add"
        Write-Host "  Install Claude Code, then run:"
        Write-Host "    claude mcp add --scope user --transport http chrome-mcp http://127.0.0.1:12306/mcp"
        return
    }

    $list = claude mcp list 2>$null
    if ($list -match "^chrome-mcp:") {
        Write-Info "chrome-mcp already registered - refreshing"
        try { claude mcp remove --scope user chrome-mcp 2>$null } catch {}
    }

    Write-Info "Adding chrome-mcp to Claude Code (user scope)"
    claude mcp add --scope user --transport http chrome-mcp http://127.0.0.1:12306/mcp | Out-Null
    Write-Ok "chrome-mcp registered with Claude Code"
}

function Show-NextSteps {
    Write-Host ""
    Write-Ok "Install complete"
    Write-Host ""
    Write-Host "Next:" -ForegroundColor White
    Write-Host "  1. " -NoNewline; Write-Host "Fully close Chrome and reopen it" -ForegroundColor Yellow
    Write-Host "     (Chrome caches the native messaging manifest at startup)"
    Write-Host "  2. Open the extension popup -> click " -NoNewline; Write-Host "Connect" -ForegroundColor White
    Write-Host "  3. Verify: " -NoNewline; Write-Host "claude mcp list" -ForegroundColor White
    Write-Host "     You should see: chrome-mcp ... Connected"
    Write-Host ""
}

# Main
Assert-Command "node"
Assert-Command "pnpm"

Write-Info "Chrome MCP Server - quick install (Windows)"
Invoke-Build
$resolvedId = Get-ExtensionId
Register-NativeHost -Id $resolvedId
Add-ClaudeMcp
Show-NextSteps
