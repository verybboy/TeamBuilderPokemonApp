# Despliegue inicial de Pokemon Team Lab

Preparado el 2026-10-14 en `aws-deploy`, desde el commit `b981fd9`.
Este documento describe el plan; no acredita que los recursos ya existan.
El plan se ejecutó posteriormente con autorización: consultar los identificadores, URL y comprobaciones en [la guía de despliegue](DEPLOYMENT.md#despliegue-del-proyecto-2026-10-14).

## Destino y recursos

- Perfil obligatorio: `pokemon-deploy`.
- Cuenta verificada: `051826724623`; identidad: `codex-pkm-deployer`.
- Bucket nuevo: `pokemon-team-lab-051826724623`, en `eu-west-1`.
- S3 Standard, cifrado SSE-S3 predeterminado, ACL deshabilitadas por defecto y las cuatro opciones de bloqueo publico activadas.
- OAC nuevo: `pokemon-team-lab-051826724623-oac`, firma SigV4 siempre.
- Una distribucion CloudFront nueva, dominio `cloudfront.net` y certificado predeterminado, redireccion HTTP a HTTPS, GET/HEAD, HTTP/2 y HTTP/3, IPv6 y compresion.
- `PriceClass_100` (Europa y Norteamerica), sin dominio comprado, zona Route 53, Web ACL WAF, logs, Origin Shield, Lambda, servidores ni claves KMS propias.
- Bucket accesible por CloudFront exclusivamente mediante una politica de lectura restringida al ARN de la nueva distribucion. No se habilita el alojamiento web S3.

Solo se publica `dist/`: 7 archivos y 2,65 MiB en la compilacion revisada.
Los assets con hash usan `CachingOptimized`; el comportamiento predeterminado configura TTL minimo y predeterminado 0, maximo 31536000, sin cookies, cabeceras de usuario ni query strings. Se usan los campos de cache clasicos en ese comportamiento para evitar crear una politica personalizada o ampliar IAM. Ambos comportamientos usan `SecurityHeadersPolicy` de AWS.
La navegacion actual no requiere fallback SPA para errores 403/404.

## Coste previsto y condiciones

Modalidad: CloudFront **por uso**, aprovechando sus cuotas Always Free. No es una suscripcion al nuevo plan flat-rate Free.
La AWS CLI instalada (2.32.16) no admite `pricing-plan-manager`; no se han comprobado elegibilidad ni permisos para ese plan. No se actualiza la CLI ni se modifica IAM durante este despliegue.

Precios S3 Standard de Irlanda contrastados con el catalogo publico oficial el 2026-10-14: 0,023 USD/GB-mes, 0,005 USD/1000 PUT/COPY/POST/LIST y 0,0004 USD/1000 GET y otras lecturas.

| Concepto | Hipotesis mensual | Coste aproximado sin creditos |
| --- | --- | --- |
| Almacenamiento S3 | 2,65 MiB | 0,00006 USD |
| Lecturas S3 desde CloudFront | 25000 a 100000 | 0,01 a 0,04 USD |
| Escrituras y listados S3 | 1000 | 0,005 USD |
| CloudFront | Dentro de la cuota gratuita disponible de la cuenta | 0 USD |
| Invalidaciones | Hasta 1000 rutas/mes en la cuenta | 0 USD |

Estimacion para esas hipotesis: **aproximadamente 0,02 a 0,05 USD/mes**, antes de impuestos, conversion de moneda o creditos. La primera carga de los 7 archivos cuesta bastante menos de un centimo en solicitudes de escritura.

CloudFront incluye 1 TB de transferencia y 10 millones de solicitudes HTTP/HTTPS al mes en Always Free; sus cuotas y las invalidaciones gratuitas se comparten con el consumo que corresponda en la cuenta. S3 a CloudFront no tiene coste de transferencia por los origin fetches.

**Esta modalidad no impone un limite automatico de gasto.** Mas trafico, mas solicitudes al origen, otras distribuciones que consuman la cuota o la acumulacion de assets antiguos pueden superar la estimacion. No se ha verificado el consumo facturado ni la disponibilidad de creditos de la cuenta. Un presupuesto avisa pero no limita el gasto; este plan no crea presupuestos ni cambia la facturacion.

Si se exige un techo garantizado de centimos independientemente del trafico, hay que revisar el plan CloudFront Free y sus costes de origen antes de ejecutar este plan. El plan flat-rate tampoco elimina por si mismo las tarifas de solicitudes S3.

Fuentes: [CloudFront por uso](https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/), [S3](https://aws.amazon.com/s3/pricing/), [catalogo regional S3](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonS3/current/eu-west-1/index.json), [planes flat-rate](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/flat-rate-pricing-plan.html).

## Comandos revisables

El script de creacion esta fijado a la cuenta y perfil anteriores. Sin `-Execute` solo escribe los JSON de configuracion en `.aws/` y muestra las operaciones; no llama a AWS:

```powershell
.\scripts\create-aws-infrastructure.ps1
```

Tras autorizacion, la creacion y primera publicacion se ejecutan con:

```powershell
.\scripts\create-aws-infrastructure.ps1 -Execute
```

Internamente consulta la identidad y comprueba duplicados; despues realiza estas operaciones, siempre con `--profile pokemon-deploy`, y con `--region eu-west-1`:

```powershell
aws s3api create-bucket --bucket pokemon-team-lab-051826724623 --create-bucket-configuration LocationConstraint=eu-west-1 --profile pokemon-deploy --region eu-west-1
aws s3api put-public-access-block --bucket pokemon-team-lab-051826724623 --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true --profile pokemon-deploy --region eu-west-1
aws cloudfront create-origin-access-control --origin-access-control-config file://.aws/oac-config.json --profile pokemon-deploy --region eu-west-1
aws cloudfront create-distribution --distribution-config file://.aws/distribution-config.json --profile pokemon-deploy --region eu-west-1
aws s3api put-bucket-policy --bucket pokemon-team-lab-051826724623 --policy file://.aws/bucket-policy.json --profile pokemon-deploy --region eu-west-1
.\scripts\deploy-aws.ps1 -Bucket pokemon-team-lab-051826724623 -DistributionId '<ID_NUEVA_DISTRIBUCION>' -Profile pokemon-deploy
```

El ultimo script sube assets, branding, licencias e index.html en ese orden e invalida `/`, `/index.html`, `/branding/*` y `/THIRD_PARTY_NOTICES.txt`. No borra objetos. El registro `.aws/deployment.json` guarda los identificadores y URL sin credenciales. No se sube ese directorio ni se versiona.
Ante un fallo parcial se conserva un registro por recurso creado y se detiene el script; revisar antes de reintentar para evitar duplicados. No modifica IAM ni adopta recursos de otros proyectos.

## Futuras publicaciones

```powershell
npm run test
npm run build
$deployment = Get-Content .aws/deployment.json -Raw | ConvertFrom-Json
.\scripts\deploy-aws.ps1 -Bucket $deployment.Bucket -DistributionId $deployment.DistributionId -Profile pokemon-deploy -Plan
# Ejecutar la misma llamada sin -Plan cuando la publicacion este autorizada.
```

Los assets antiguos se conservan para sesiones abiertas; antes de acumular muchas versiones conviene acordar su limpieza. Para trasladar equipos de localhost a la URL de produccion, exportar e importar la copia de seguridad de la aplicacion.
