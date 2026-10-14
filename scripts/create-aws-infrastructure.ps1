# Preparado para la cuenta y proyecto revisados; sin -Execute solo genera el plan local.
[CmdletBinding()]
param([switch]$Execute)

$ErrorActionPreference = 'Stop'
$profile = 'pokemon-deploy'
$account = '051826724623'
$bucket = 'pokemon-team-lab-051826724623'
$region = 'eu-west-1'
$projectRoot = Split-Path $PSScriptRoot -Parent
$configDirectory = Join-Path $projectRoot '.aws'
$null = New-Item -ItemType Directory -Path $configDirectory -Force

# Conservar los JSON efectivos cuando ya hay recursos creados.
if ($Execute) {
    foreach ($name in @('created-bucket.json', 'created-oac.json', 'created-distribution.json')) {
        if (Test-Path -LiteralPath (Join-Path $configDirectory $name)) { throw "Ya existe $name. Revisar los recursos antes de continuar para evitar duplicados." }
    }
}

function Write-JsonFile {
    param([string]$Name, $Value)
    $path = Join-Path $configDirectory $Name
    [System.IO.File]::WriteAllText($path, ($Value | ConvertTo-Json -Depth 30), [System.Text.UTF8Encoding]::new($false))
}

function Invoke-AwsJson {
    param([string[]]$Arguments)
    $output = & aws @Arguments --profile $profile --region $region --no-cli-pager --output json --cli-connect-timeout 10 --cli-read-timeout 60
    if ($LASTEXITCODE -ne 0) { throw ('AWS ha fallado: ' + ($Arguments -join ' ')) }
    if ($output) { return ($output -join "`n" | ConvertFrom-Json) }
}

$oacConfig = [ordered]@{
    Name = "$bucket-oac"
    Description = 'Acceso privado exclusivo de Pokemon Team Lab'
    SigningProtocol = 'sigv4'
    SigningBehavior = 'always'
    OriginAccessControlOriginType = 's3'
}
Write-JsonFile 'oac-config.json' $oacConfig

# El comportamiento predeterminado conserva TTL 0 sin crear una politica de cache
# adicional ni ampliar IAM. Los assets usan la politica administrada de AWS.
$distribution = [ordered]@{
    CallerReference = 'pokemon-team-lab-051826724623-initial-20261014'
    Aliases = @{ Quantity = 0 }
    DefaultRootObject = 'index.html'
    Origins = @{
        Quantity = 1
        Items = @(@{
            Id = 'pokemon-team-lab-s3'
            DomainName = "$bucket.s3.$region.amazonaws.com"
            S3OriginConfig = @{ OriginAccessIdentity = '' }
            OriginAccessControlId = 'PENDING_OAC_ID'
        })
    }
    DefaultCacheBehavior = @{
        TargetOriginId = 'pokemon-team-lab-s3'
        ViewerProtocolPolicy = 'redirect-to-https'
        AllowedMethods = @{ Quantity = 2; Items = @('GET', 'HEAD'); CachedMethods = @{ Quantity = 2; Items = @('GET', 'HEAD') } }
        Compress = $true
        TrustedSigners = @{ Enabled = $false; Quantity = 0 }
        ForwardedValues = @{ QueryString = $false; Cookies = @{ Forward = 'none' }; Headers = @{ Quantity = 0 }; QueryStringCacheKeys = @{ Quantity = 0 } }
        MinTTL = 0
        DefaultTTL = 0
        MaxTTL = 31536000
        ResponseHeadersPolicyId = '67f7725c-6f97-4210-82d7-5512b31e9d03'
    }
    CacheBehaviors = @{
        Quantity = 1
        Items = @(@{
            PathPattern = '/assets/*'
            TargetOriginId = 'pokemon-team-lab-s3'
            ViewerProtocolPolicy = 'redirect-to-https'
            AllowedMethods = @{ Quantity = 2; Items = @('GET', 'HEAD'); CachedMethods = @{ Quantity = 2; Items = @('GET', 'HEAD') } }
            Compress = $true
            TrustedSigners = @{ Enabled = $false; Quantity = 0 }
            CachePolicyId = '658327ea-f89d-4fab-a63d-7e88639e58f6'
            ResponseHeadersPolicyId = '67f7725c-6f97-4210-82d7-5512b31e9d03'
        })
    }
    CustomErrorResponses = @{ Quantity = 0 }
    Comment = 'Pokemon Team Lab | aws-deploy | S3 privado | coste minimo'
    Logging = @{ Enabled = $false; IncludeCookies = $false; Bucket = ''; Prefix = '' }
    PriceClass = 'PriceClass_100'
    Enabled = $true
    ViewerCertificate = @{ CloudFrontDefaultCertificate = $true }
    Restrictions = @{ GeoRestriction = @{ RestrictionType = 'none'; Quantity = 0 } }
    WebACLId = ''
    HttpVersion = 'http2and3'
    IsIPV6Enabled = $true
}
Write-JsonFile 'distribution-config.json' $distribution

if (-not $Execute) {
    Write-Output "PLAN LOCAL: cuenta $account; perfil $profile; bucket $bucket; region $region."
    Write-Output 'CloudFront por uso: no es una suscripcion al plan flat-rate Free ni tiene limite duro de gasto.'
    Write-Output "aws s3api create-bucket --bucket $bucket --create-bucket-configuration LocationConstraint=$region --profile $profile --region $region"
    Write-Output "aws s3api put-public-access-block --bucket $bucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true --profile $profile --region $region"
    Write-Output "aws cloudfront create-origin-access-control --origin-access-control-config file://.aws/oac-config.json --profile $profile"
    Write-Output "aws cloudfront create-distribution --distribution-config file://.aws/distribution-config.json --profile $profile"
    Write-Output "aws s3api put-bucket-policy --bucket $bucket --policy file://.aws/bucket-policy.json --profile $profile --region $region"
    Write-Output ".\scripts\deploy-aws.ps1 -Bucket '$bucket' -DistributionId '<ID_NUEVA_DISTRIBUCION>' -Profile '$profile'"
    return
}

& node (Join-Path $projectRoot 'scripts/verify-dist.mjs')
if ($LASTEXITCODE -ne 0) { throw 'El paquete de produccion no es valido.' }
$identity = Invoke-AwsJson -Arguments @('sts', 'get-caller-identity')
if ($identity.Account -ne $account) { throw 'La cuenta no coincide con el plan revisado.' }

$existing = Invoke-AwsJson -Arguments @('cloudfront', 'list-distributions')
foreach ($item in $existing.DistributionList.Items) {
    if ($item.Origins.Items.DomainName -contains "$bucket.s3.$region.amazonaws.com") { throw 'El proyecto ya tiene una distribucion. Revisar antes de crear otra.' }
}
$existingOac = Invoke-AwsJson -Arguments @('cloudfront', 'list-origin-access-controls')
if ($existingOac.OriginAccessControlList.Items.Name -contains $oacConfig.Name) { throw 'El proyecto ya tiene un OAC. Revisar antes de crear otro.' }

# CreateBucket falla ante un bucket existente en eu-west-1: no adoptar uno ajeno.
$createdBucket = Invoke-AwsJson -Arguments @('s3api', 'create-bucket', '--bucket', $bucket, '--create-bucket-configuration', "LocationConstraint=$region")
Write-JsonFile 'created-bucket.json' $createdBucket
$null = Invoke-AwsJson -Arguments @('s3api', 'put-public-access-block', '--bucket', $bucket, '--public-access-block-configuration', 'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true')
$createdOac = Invoke-AwsJson -Arguments @('cloudfront', 'create-origin-access-control', '--origin-access-control-config', ('file://' + (Join-Path $configDirectory 'oac-config.json')))
Write-JsonFile 'created-oac.json' $createdOac
$distribution.Origins.Items[0].OriginAccessControlId = $createdOac.OriginAccessControl.Id
Write-JsonFile 'distribution-config.json' $distribution
$createdDistribution = Invoke-AwsJson -Arguments @('cloudfront', 'create-distribution', '--distribution-config', ('file://' + (Join-Path $configDirectory 'distribution-config.json')))
Write-JsonFile 'created-distribution.json' $createdDistribution
$bucketPolicy = @{
    Version = '2012-10-17'
    Statement = @(@{
        Sid = 'AllowOnlyProjectCloudFrontRead'
        Effect = 'Allow'
        Principal = @{ Service = 'cloudfront.amazonaws.com' }
        Action = 's3:GetObject'
        Resource = "arn:aws:s3:::$bucket/*"
        Condition = @{ StringEquals = @{ 'AWS:SourceArn' = $createdDistribution.Distribution.ARN } }
    })
}
Write-JsonFile 'bucket-policy.json' $bucketPolicy
$null = Invoke-AwsJson -Arguments @('s3api', 'put-bucket-policy', '--bucket', $bucket, '--policy', ('file://' + (Join-Path $configDirectory 'bucket-policy.json')))

Write-JsonFile 'deployment.json' @{
    Account = $account
    Profile = $profile
    Region = $region
    Bucket = $bucket
    OriginAccessControlId = $createdOac.OriginAccessControl.Id
    DistributionId = $createdDistribution.Distribution.Id
    DistributionArn = $createdDistribution.Distribution.ARN
    Url = ('https://' + $createdDistribution.Distribution.DomainName + '/')
    Pricing = 'Pay-as-you-go / Always Free allowances; no hard spending cap'
}
& (Join-Path $projectRoot 'scripts/deploy-aws.ps1') -Bucket $bucket -DistributionId $createdDistribution.Distribution.Id -Profile $profile
Write-Output ('URL: https://' + $createdDistribution.Distribution.DomainName + '/')
