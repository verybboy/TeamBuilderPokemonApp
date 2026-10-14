# Publica solo dist/ en recursos existentes. -Plan no llama a AWS.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$')]
    [string]$Bucket,
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Z0-9]+$')]
    [string]$DistributionId,
    [ValidateNotNullOrEmpty()]
    [string]$Profile = 'pokemon-deploy',
    [switch]$Plan
)

$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$distPath = Join-Path $projectRoot 'dist'
& node (Join-Path $PSScriptRoot 'verify-dist.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Genera un paquete valido con npm run build.' }
if (-not $Plan) { $null = Get-Command aws -ErrorAction Stop }

function Invoke-DeployStep {
    param([string[]]$Arguments)
    $awsArguments = @($Arguments) + @('--no-cli-pager')
    $awsArguments += @('--profile', $Profile)
    if ($Plan) {
        $quoted = $awsArguments | ForEach-Object { "'" + $_.Replace("'", "''") + "'" }
        Write-Output ('aws ' + ($quoted -join ' '))
        return
    }
    & aws @awsArguments
    if ($LASTEXITCODE -ne 0) { throw 'AWS devolvio un error. Se ha detenido el despliegue.' }
}

# Conserva los assets antiguos para sesiones que todavia usan el HTML anterior.
Invoke-DeployStep -Arguments @(
    's3', 'sync', (Join-Path $distPath 'assets'), "s3://$Bucket/assets/",
    '--cache-control', 'public,max-age=31536000,immutable', '--only-show-errors'
)
Invoke-DeployStep -Arguments @(
    's3', 'cp', (Join-Path $distPath 'branding'), "s3://$Bucket/branding/",
    '--recursive', '--cache-control', 'no-cache', '--only-show-errors'
)
Invoke-DeployStep -Arguments @(
    's3', 'cp', (Join-Path $distPath 'THIRD_PARTY_NOTICES.txt'), "s3://$Bucket/THIRD_PARTY_NOTICES.txt",
    '--content-type', 'text/plain; charset=utf-8', '--cache-control', 'no-cache',
    '--only-show-errors'
)
# Publica el HTML despues de todos sus recursos.
Invoke-DeployStep -Arguments @(
    's3', 'cp', (Join-Path $distPath 'index.html'), "s3://$Bucket/index.html",
    '--content-type', 'text/html; charset=utf-8', '--cache-control', 'no-cache',
    '--only-show-errors'
)
Invoke-DeployStep -Arguments @(
    'cloudfront', 'create-invalidation', '--distribution-id', $DistributionId,
    '--paths', '/', '/index.html', '/branding/*', '/THIRD_PARTY_NOTICES.txt'
)
