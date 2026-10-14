# S3 + CloudFront

TEAMLAB es una aplicación estática. Este procedimiento publica el contenido de `dist/` en la raíz de un bucket dedicado y lo sirve mediante CloudFront. No requiere backend ni variables de entorno. Los recursos de PokéAPI, sprites remotos y Google Fonts se consultan desde el navegador.

## Compilar

Requisitos de desarrollo: Node.js 22.15 o posterior dentro de la rama 22, o Node.js 24 o posterior; npm 10 o posterior. Para publicar necesitas también AWS CLI v2 y un perfil con permisos sobre el bucket y la distribución elegidos.

```powershell
npm ci
npm run test
npm run build
npm run preview
```

Si la instalación se queda bloqueada con la caché habitual de npm, usa `npm ci --cache .npm-cache` para crear una caché aislada dentro del repositorio. Este directorio está excluido de Git y se puede eliminar al terminar. La comprobación desde cero de este repositorio se completó con una caché aislada.

`build` verifica TypeScript, genera recursos con nombres versionados y comprueba el contenido de `dist/`. También puedes ejecutar `npm run check:dist`. Solo se publican `index.html`, `assets/`, el sprite de `branding/` y `THIRD_PARTY_NOTICES.txt`, con los avisos de licencia necesarios para distribuir los componentes. Quedan fuera el repositorio, `node_modules/`, pruebas, documentación general, credenciales y mapas de código fuente.

## Configurar AWS

1. Crea un bucket S3 dedicado, con **Block all public access** activado y **Object Ownership: Bucket owner enforced**. Usa el cifrado predeterminado SSE-S3.
2. Crea una distribución CloudFront cuyo origen sea el bucket S3 normal (su endpoint REST regional). Configura **Origin Access Control (OAC)**, tipo S3 y **Sign requests: always**. Aplica al bucket la política de lectura que proporciona CloudFront, restringida al ARN de esa distribución. No habilites el alojamiento web de S3. Consulta [la configuración oficial de OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html).
3. Define **Default root object: `index.html`**, **Viewer protocol policy: Redirect HTTP to HTTPS**, métodos **GET, HEAD**, compresión automática y ninguna cookie, cabecera de usuario ni query string en la clave de caché.
4. Configura dos comportamientos, con el mismo origen:

   | Ruta               | Política de caché                                                                                              | Cabecera que sube el script             |
   | ------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
   | `/assets/*`        | `CachingOptimized`, compresión Gzip/Brotli                                                                     | `public,max-age=31536000,immutable`     |
   | Predeterminado `*` | Política personalizada: Minimum TTL **0**, Default TTL **0**, Maximum TTL **31536000**; compresión Gzip/Brotli | `no-cache` para HTML, branding y avisos |

   El mínimo 0 permite respetar `no-cache`. Un mínimo positivo puede mantener esos objetos en caché aunque el origen solicite revalidarlos. Los archivos con hash pueden conservarse durante un año porque cada compilación cambia su URL cuando cambia su contenido. Véanse [los TTL de CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html) y [la actualización de objetos versionados](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/UpdatingExistingObjects.html).

5. Opcionalmente, aplica la política de cabeceras de respuesta `SecurityHeadersPolicy`. Para un dominio propio, añade su alias y un certificado ACM de **us-east-1**, y configura el DNS hacia CloudFront. El dominio asignado `https://….cloudfront.net/` sirve sin dominio propio.

La navegación actual usa estado de React y no rutas URL. No necesita redirigir los errores 403/404 a `index.html`; así los recursos inexistentes mantienen su error real. El sitio debe alojarse en `/`, no en un subdirectorio.

## Publicar

Una vez creados y configurados el bucket y la distribución, revisa las operaciones localmente:

```powershell
.\scripts\deploy-aws.ps1 -Bucket 'pokemon-team-lab-mi-bucket' -DistributionId 'E123456789ABC' -Profile 'pokemon-deploy' -Plan
```

`-Plan` verifica el paquete y muestra los comandos sin contactar con AWS. Todos los comandos usan un perfil explícito; el valor predeterminado es `pokemon-deploy`. El bucket y la distribución de los ejemplos son marcadores: sustitúyelos por tus recursos reales. Para ejecutar la publicación, retira ese argumento:

```powershell
.\scripts\deploy-aws.ps1 -Bucket 'pokemon-team-lab-mi-bucket' -DistributionId 'E123456789ABC' -Profile 'pokemon-deploy'
```

El script sube primero los assets con hash, después branding y los avisos, y finalmente el HTML. Detiene las operaciones al primer error e invalida `/`, `/index.html`, `/branding/*` y `/THIRD_PARTY_NOTICES.txt`. Los cambios se ven cuando CloudFront termina la invalidación. No borra objetos del bucket: los assets anteriores permiten que las sesiones abiertas sigan cargando sus módulos. En publicaciones posteriores puedes retirar versiones antiguas cuando ya no deban soportarse esas sesiones. [AWS CLI documenta las opciones de sincronización y caché](https://docs.aws.amazon.com/cli/latest/reference/s3/sync.html).

## Comprobar la publicación

- Abre la URL HTTPS y comprueba constructor, MiniWiki, calculadoras, sprites y modo oscuro; recarga la página.
- En las herramientas de red, verifica respuestas 200 y MIME correcto para HTML, JavaScript, CSS y PNG. Comprueba `Cache-Control` según la tabla anterior y ausencia de errores CORS en las consultas externas.
- La URL directa del objeto en el bucket debe estar bloqueada; la de CloudFront debe servirlo.
- Guarda un equipo, recarga y comprueba que se conserva. Los datos siguen en `localStorage` y son propios de cada origen: para llevar los guardados de localhost o de otro dominio a producción, exporta la copia completa en la aplicación e impórtala en el dominio definitivo.

La preparación del repositorio no crea recursos de AWS ni publica nada. El script solo debe ejecutarse sin `-Plan` cuando el bucket, la distribución y el perfil sean los de destino.
