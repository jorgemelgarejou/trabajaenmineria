# trabajaenmineria.cl

Repetidor de ofertas de empleo en minería en Chile: reúne las ofertas publicadas en el mercado y enlaza a la fuente original. Nadie se registra (ni empresas ni postulantes). Sitio estático con actualización automática cada 4 horas (GitHub Actions), creador y analizador de CV con IA, monetizado con Google AdSense y enlaces de afiliado.

```
site/                    ← lo que se publica
  index.html             buscador, filtros por región/categoría, video, anuncios intercalados
  cv.html, cv.js         creador y analizador de CV con IA
  config.js              de dónde leer las ofertas y dónde está la IA
  _headers               encabezados de caché y seguridad (Netlify)
  privacy-filter.js      quita datos personales antes de usar la IA
  privacidad.html        política exigida por AdSense
  ads.txt, robots.txt, sitemap.xml, CNAME (solo GitHub Pages)
  data/jobs.json         generado automáticamente
  data/manual.json       ofertas públicas que agregas a mano
netlify.toml             configuración de Netlify
netlify/functions/cv.mts IA en Netlify (responde en /api/cv)
worker/                  IA en Cloudflare (alternativa a Netlify)
lib/cv-core.ts           lógica de la IA, compartida por Netlify y Cloudflare
scripts/
  fetch_jobs.py          recolector de ofertas (Python, sin dependencias)
  sources.json           feeds RSS adicionales
  build-netlify-drop.ps1 arma la carpeta y el zip para Netlify Drop
dist/netlify-drop/       versión lista para arrastrar a Netlify Drop
.github/workflows/deploy.yml   actualiza ofertas cada 4 horas
```

## 1. Publicar

Hay dos formas, ambas con plan gratis. **Netlify es la recomendada**: el sitio y la IA del CV quedan juntos y se configuran en un solo lugar.

### Opción A: Netlify (recomendada)

1. Crea una cuenta en github.com y un repositorio, por ejemplo `trabajaenmineria`. Sube todo el contenido de esta carpeta (rama `main`).
2. Crea una cuenta gratis en netlify.com → **Add new project → Import an existing project → GitHub** y elige el repositorio. Netlify lee `netlify.toml` solo: carpeta publicada `site`, funciones en `netlify/functions`. Presiona **Deploy**.
3. En Netlify: **Project configuration → Environment variables → Add a variable**:
   - `ANTHROPIC_API_KEY`: tu clave de console.anthropic.com (márcala como secreta). Activa la IA del CV.
   - Opcionales: `MODEL`, `EFFORT`, `PER_IP_LIMIT`, `DAILY_LIMIT` (ver sección 5).
4. En GitHub: **Settings → Secrets and variables → Actions → pestaña Variables → New repository variable**: `HOSTING` = `netlify`. Así el workflow solo actualiza las ofertas, y Netlify publica cada actualización automáticamente.
5. **Actions → "Actualizar ofertas y publicar" → Run workflow** para cargar las primeras ofertas.

El sitio queda en `https://NOMBRE.netlify.app` hasta que conectes el dominio. Para probar todo en tu PC (sitio + IA), con Node instalado:

```bash
npm install
```

```bash
npx netlify dev
```

Cosas a saber del plan gratis de Netlify: las funciones se cortan a los 60 segundos (por eso la IA usa esfuerzo `low` por defecto, que responde más rápido), y el tráfico y las llamadas a funciones consumen los créditos mensuales del plan. El video (12 MB) solo se descarga cuando alguien aprieta play.

### Opción A2: Netlify Drop (arrastrar y soltar, sin GitHub ni comandos)

[Netlify Drop](https://app.netlify.com/drop) publica una carpeta arrastrándola al navegador. Ya está armada en `dist/netlify-drop/` (y como zip en `dist/trabajaenmineria-netlify-drop.zip`).

1. Entra a netlify.com e **inicia sesión primero** (lo que se sube sin cuenta se borra a la hora).
2. Abre https://app.netlify.com/drop y arrastra la carpeta `dist/netlify-drop` (o el zip).
3. Para actualizar el sitio después: en tu proyecto de Netlify → **Deploys** → arrastra de nuevo la carpeta.

Lo que Drop no hace, y cómo resolverlo:

- **No ejecuta funciones**, así que la IA del CV queda desactivada: el creador y las descargas Word/PDF sí funcionan. Para tener IA, publica el Worker de Cloudflare (sección 5) y vuelve a armar el paquete con su URL.
- **No actualiza las ofertas solo.** Si subes el proyecto a GitHub con el workflow activo, arma el paquete con `-GitHubRepo` y el sitio leerá las ofertas que el workflow actualiza cada 4 horas en GitHub, sin volver a subir nada.

Para volver a armar el paquete (por ejemplo, con tu repositorio y tu Worker):

```bash
powershell -ExecutionPolicy Bypass -File scripts\build-netlify-drop.ps1 -GitHubRepo "usuario/trabajaenmineria" -CvApiUrl "https://cv-api.tu-cuenta.workers.dev/api/cv"
```

Si usas el Worker con Netlify Drop, agrega la dirección de tu sitio (por ejemplo `https://NOMBRE.netlify.app`) a `ALLOWED_ORIGINS` en `worker/wrangler.toml`.

### Opción B: GitHub Pages (+ Cloudflare para la IA)

1. Sube el proyecto a un repositorio público de GitHub (rama `main`). No crees la variable `HOSTING`.
2. En el repo: **Settings → Pages → Source: GitHub Actions**.
3. **Actions → "Actualizar ofertas y publicar" → Run workflow**. El sitio queda en `https://TU_USUARIO.github.io/trabajaenmineria/`.
4. GitHub Pages no ejecuta funciones: para la IA del CV usa el Worker de Cloudflare (sección 5).

## 2. Conectar el dominio trabajaenmineria.cl

Hoy el dominio no resuelve en DNS, así que primero hay que registrarlo: en [nic.cl](https://www.nic.cl) (lo único que cuesta: aprox. $10.000 CLP al año).

**Con Netlify:** en **Domain management → Add a domain** escribe `trabajaenmineria.cl`. Netlify te ofrece dos caminos:
- Usar Netlify DNS: en NIC Chile cambias los servidores DNS por los 4 que te muestra Netlify. Es lo más simple.
- Mantener otro DNS (por ejemplo Cloudflare): crea `A  @  75.2.60.5` y `CNAME  www  NOMBRE.netlify.app`.

El certificado HTTPS lo activa Netlify solo.

**Con GitHub Pages:** crea `A  @` hacia `185.199.108.153`, `185.199.109.153`, `185.199.110.153` y `185.199.111.153`, y `CNAME  www  TU_USUARIO.github.io`. Luego en **Settings → Pages → Custom domain** escribe `trabajaenmineria.cl` y marca **Enforce HTTPS** (el archivo `site/CNAME` ya lo tiene).

## 3. Fuentes de ofertas

Cada fuente es opcional. Las claves se guardan en **Settings → Secrets and variables → Actions**.

| Fuente | Cómo obtenerla | Secreto |
|---|---|---|
| **Jooble** | Pide una clave gratis en jooble.org/api/about | `JOOBLE_KEY` |
| **Careerjet** | Crea una cuenta de publisher en careerjet.com y copia tu API key (pagan por clic; confirma con ellos que cubren Chile) | `CAREERJET_API_KEY` |
| **Portales de mineras** | Ya activos: Codelco, BHP (solo Chile) y Teck (solo Chile). Se leen desde el `sitemap.xml` que publican, solo páginas de ofertas permitidas por su `robots.txt`, una por segundo. Para sumar otra empresa con portal SAP SuccessFactors, agrégala en `career_sites` de `scripts/sources.json` | — |
| **Portal Minero** | Ya activo. Bolsa de empleo del sector minero; se lee desde su `sitemap-ofertas.xml` y los datos estándar (JSON-LD) de cada oferta. Su `robots.txt` lo permite | — |
| **Chiletrabajos** | Ya activo. Se lee su feed RSS público (~30.000 ofertas) y se dejan solo las de minería. **Sus términos piden consentimiento escrito para reutilizar su contenido: solicítalo y, si lo niegan, pon `"enabled": false` en `scripts/sources.json`** | — |
| **Feeds RSS** | Agrega otros feeds en `scripts/sources.json` (solo con autorización del sitio) | — |
| **Manual** | Agrega ofertas en `site/data/manual.json` | — |

Formato de `manual.json` (para ofertas públicas que encuentres, por ejemplo en la página de trabajo de una minera; `url` es donde se postula):

```json
[{"title": "Operador CAEX 7x7", "company": "Empresa X", "location": "Calama",
  "url": "https://...", "description": "...", "salary": "$1.800.000",
  "date": "2026-10-30", "expires": "2026-11-30", "source": "Sitio de Empresa X"}]
```

**Importante:** solo usa fuentes que lo permitan (APIs oficiales y feeds públicos). No copies contenido de portales como Laborum, Trabajando.com o LinkedIn sin autorización: lo prohíben sus términos y te pueden bloquear o denunciar. Cada oferta enlaza siempre a la fuente original.

Probar en tu PC:

```bash
python scripts/fetch_jobs.py
```

```bash
python -m http.server 8000 -d site
```

## 4. Monetizar

1. **Google AdSense**: con el sitio ya en `trabajaenmineria.cl` y algo de contenido, postula en adsense.google.com. Cuando te aprueben, todo se configura en `site/config.js`: pon tu ID en `adClient` y crea cuatro bloques de anuncio en AdSense para llenar `adSlots` (`lateral` 300×250, `listado` In-feed con su `adLayoutKey`, `pie` horizontal y `cv`). Pon también tu ID en `site/ads.txt` (allí va sin `ca-`). Cada anuncio tiene su espacio fijo con la etiqueta "Publicidad"; un espacio sin ID o sin anuncio no se muestra. Para ver dónde irán antes de la aprobación, abre `https://trabajaenmineria.cl/?ver-anuncios`. El banner de Mirrow está en `index.html` y `cv.html`, y su enlace se cambia en `mirrowUrl`.
2. **Afiliados**: Careerjet y Jooble pagan por los clics que envías a sus ofertas.

## 5. CV con IA (`site/cv.html`)

Dos herramientas, sin registro. El CV se guarda solo en el navegador de cada persona:

- **Crear mi CV**: formulario con vista previa en vivo y descarga en PDF (usa la impresión del navegador → "Guardar como PDF").
- **Mejorar mi CV con IA**: la persona sube su CV (PDF, Word o texto; se lee dentro del navegador), indica el cargo y lo que quiere destacar. La IA devuelve un puntaje, fortalezas, qué mejorar, palabras clave faltantes y un CV reescrito, que queda listo para editar y descargar.

La IA nunca inventa experiencia, fechas ni certificados: lo que no está respaldado lo deja como "pendiente" o como `[completar]` (resaltado en amarillo en la vista previa).

**Privacidad:** los datos personales (nombre, RUT, teléfono, dirección, correo, LinkedIn, fecha de nacimiento, estado civil, nacionalidad) no se envían a la IA. `site/privacy-filter.js` los quita en el navegador apenas se sube o pega el CV y le muestra a la persona qué se quitó; el servidor (`lib/cv-core.ts`) los vuelve a filtrar y la respuesta de la IA no tiene campos para ellos.

**Descarga en Word:** el botón "Descargar Word" genera un `.docx` en el navegador. Los datos personales que la persona no haya escrito en el creador (ni se enviaron a la IA) quedan como campos resaltados en amarillo (`[Nombre completo]`, `[RUT]`, `[Teléfono]`, `[Correo]`, `[Dirección o ciudad]`) para completarlos a mano. También se puede descargar en PDF.

### Corrector local (activo por defecto)

Sin conectar ninguna IA, `site/cv-local.js` revisa y reestructura el CV en el navegador con criterios de reclutamiento minero: separa secciones, ordena la experiencia, reescribe funciones como logros con verbo en pasado, normaliza fechas y licencias, compara con las palabras clave de 11 familias de cargos y devuelve puntaje, fortalezas, brechas y pendientes en el mismo formato que la IA. No inventa datos: lo que falta queda como `[completar]`. Se controla en `site/config.js` con `cvMotor: "local"`.

### Activar la IA

Cuando quieras usar Claude, cambia `cvMotor` a `"ia"` en `site/config.js`. Si la IA falla o no tiene clave, la página vuelve sola al corrector local.

Necesitas una API key de console.anthropic.com (la API de IA se paga por uso; ver costos abajo). La clave queda en el servidor, nunca en la página.

**En Netlify:** basta con la variable `ANTHROPIC_API_KEY` (paso 3 de la opción A). La IA responde en `/api/cv` del mismo sitio, que es lo que ya usa `site/cv.js`. Los topes diarios funcionan solos con Netlify Blobs: 5 análisis por persona y 200 en total al día.

| Variable (opcional) | Por defecto | Para qué |
|---|---|---|
| `MODEL` | `claude-opus-5-5` | Modelo de IA |
| `EFFORT` | `low` | `low` responde en ~20–40 s; `medium` escribe mejor, pero puede pasar el límite de 60 s de Netlify |
| `PER_IP_LIMIT` | `5` | Análisis por persona al día |
| `DAILY_LIMIT` | `200` | Análisis totales al día (tope de gasto) |

**En Cloudflare (si usas GitHub Pages):** crea una cuenta gratis en Cloudflare y, en la raíz del proyecto, ejecuta:

```bash
npm install
```

```bash
npx wrangler login
```

```bash
npx wrangler secret put ANTHROPIC_API_KEY --config worker/wrangler.toml
```

```bash
npm run worker:deploy
```

Wrangler te muestra la URL (por ejemplo `https://cv-api.tu-cuenta.workers.dev`). Pégala en `site/config.js`, en `cvApiUrl`, agregando `/api/cv` al final. Para los topes diarios, crea el KV y descomenta el bloque `[[kv_namespaces]]` en `worker/wrangler.toml` con el id que te entrega:

```bash
npx wrangler kv namespace create RATE --config worker/wrangler.toml
```

**Costos de la IA:** el modelo por defecto es Claude Opus 5.5 (el de mejor calidad). Cada análisis cuesta del orden de USD 0,05 a 0,15. Con el tope de 200 diarios, el máximo sería unos USD 20 a 30 al día. Para bajar mucho el costo, cambia `MODEL` a `claude-haiku-5-5`: queda en menos de USD 0,01 por análisis, con menor calidad de redacción. Puedes ver el gasto y poner un límite mensual en console.anthropic.com.

## 6. Video explicativo

`site/media/explicativo.mp4` (71 s, 720p, 8 escenas) lo narra **Rodrigo**, un operador CAEX de Calama (personaje ficticio), y su boca se mueve sincronizada con la voz. Presenta el buscador de ofertas y, en la escena 7, el analizador de CV con IA.

La voz se reproduce un 15 % más lenta que como se grabó, sin cambiar el tono, y con 1 segundo de pausa entre escenas, para que se entienda bien. Se ajusta con `SPEECH_RATE` y `SCENE_GAP` en `video/render.html`.

La voz es sintética: se diseñó con Hume Octave como "minero chileno del norte, voz de bajo-barítono" y se clonó como voz fija en ElevenLabs (voz personalizada "Rodrigo minero chileno grave (trabajaenmineria)" en la cuenta de Speko, id `nvkYXCfQbodcf2u29ivZ`, tono medio ~125 Hz). Las escenas se generan con el modelo `eleven_v3`; para regrabar una escena, usa esa voz con el mismo modelo, así suena siempre el mismo Rodrigo. (La voz anterior, más aguda, es "Rodrigo minero chileno (trabajaenmineria)"; ya no se usa.)

- `video/audio/s1.wav … s8.wav`: un clip de voz por escena.
- `video/scenes.js`: las escenas animadas (rajo al amanecer, camión, mapa, maquetas del sitio).
- `video/render.html`: genera el MP4, el póster y los subtítulos `.vtt`.

Para regenerarlo (por ejemplo, después de cambiar textos o voz), abre el sitio local con el servidor de `.claude/serve.ps1` en la raíz del proyecto, entra a `/video/render.html` en Chrome o Edge y presiona **Generar MP4**. Si cambias el guion, actualiza también `CAPTIONS` en `render.html`.

## 7. LinkedIn y portales de empleo

**Lo que no se puede:** LinkedIn, Laborum, Trabajando.com, Computrabajo e Indeed no ofrecen una API pública para leer sus ofertas, y sus términos prohíben copiarlas con robots. LinkedIn solo da acceso a su API de empleos a socios aprobados (sistemas de reclutamiento de empresas).

**Lo que sí está listo en el sitio:**

- Botón **Compartir en LinkedIn** en cada oferta y en la barra lateral. Comparte el enlace de la oferta dentro de trabajaenmineria.cl, así la visita llega a tu sitio (y a tus anuncios).
- **Feed RSS** en `/feed.xml` con las 50 ofertas más nuevas, regenerado cada 4 horas por el workflow. Si usas otro dominio, crea la variable del repo `SITE_URL` (por ejemplo `https://trabajosenmineria.cl`).

**Publicar las ofertas solas en LinkedIn:**

1. Crea una **página de empresa** en LinkedIn para Trabaja en Minería (Para empresas → Crear una página).
2. Conecta el feed `https://trabajaenmineria.cl/feed.xml` con una herramienta de automatización que publique en páginas de LinkedIn, por ejemplo Zapier o Make ("RSS → LinkedIn Page"). Sus planes gratis tienen límites de publicaciones al mes; revisa cuántas te permiten.
3. Haz lo mismo con Facebook o un canal de WhatsApp si quieres.

**Sumar más ofertas legalmente:** usa programas de afiliados que entregan ofertas por API o feed (Jooble y Careerjet ya están conectados en `scripts/fetch_jobs.py`); revisa si otros, como Talent.com, ofrecen programa de publishers para Chile. También puedes pedir a contratistas y empresas mineras que te envíen sus ofertas, o agregar ofertas públicas a mano en `site/data/manual.json`.

## 8. Atraer visitas (SEO)

- Da de alta el sitio en Google Search Console y envía `sitemap.xml`.
- Los enlaces por región (`?region=Antofagasta`) sirven para compartir en grupos de Facebook/WhatsApp de trabajadores mineros.
