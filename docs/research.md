# Investigación: TinyJPG / TinyPNG

Fecha: 2026-10-20. Investigación hecha con REA 6.7.0 (MCP + CLI) desde Claude Code, en un contenedor cloud.

> Resumen honesto: **no se pudo observar en vivo la web de TinyJPG/TinyPNG.** La política de red del
> entorno deniega `tinyjpg.com`, `tinypng.com`, `tinify.com` y `web.archive.org`. Por eso, todo lo que
> describe la interfaz web original viene de fuentes secundarias (snippets de búsqueda) y se marca como
> **no verificado por observación directa**. Lo único analizado de primera mano con REA es el cliente
> oficial open source `tinify` (npm, MIT), que documenta la API comercial, no el compresor web gratuito.

## 1. Entorno y herramientas

| Herramienta | Estado | Evidencia |
|---|---|---|
| REA MCP (`rea mcp`) | Conectado en Claude Code, 207 herramientas | `claude mcp list` → `√ Connected`; `binary_session` respondió |
| `rea doctor --client claude_code --skill` | `healthy: true` (registro + skill alineados) | salida de doctor |
| Motores nativos (Ghidra, IDA, Hopper, JADX, Kuna) | No instalados | doctor: `missing_analysis_engine` (no hacen falta para JS/web) |
| Chromium (Playwright 1.56 / Chromium 141) | Disponible en `/opt/pw-browsers` | usado por REA `capture_browser_scenario` |
| Red hacia tinyjpg.com / tinypng.com / tinify.com | **Bloqueada por política** (CONNECT 403) | `docs/evidence/egress-proxy-denials.json` |
| WebFetch hacia tinypng.com | Falla (`ENOTFOUND`) | sesión de investigación |
| WebSearch | Disponible (solo títulos/snippets) | ver §4 |
| npm registry / GitHub | Accesibles | usados para `tinify` y códecs |

### 1.1 Intentos con REA contra la web oficial

- `capture_browser_scenario` (MCP y CLI), lanzando Chromium a `https://tinyjpg.com/` y `https://tinypng.com/`:
  la petición de documento falla con `net::ERR_NAME_NOT_RESOLVED` antes de capturar el estado inicial.
  Evidencia: `docs/evidence/rea-browser-scenario-tinyjpg.com.json`, `...-tinypng.com.json`.
- Consecuencia: no se pudieron usar `inspect_web_page`, `analyze_web_bundle`, `trace_web_module_imports`,
  `inspect_web_event_listeners` ni `observe_web_session` sobre el sitio real. **No hay HAR, DOM, bundle ni
  capturas de pantalla del original.** Cualquier afirmación sobre su JavaScript sería inventada, así que no se hace.

**Cómo desbloquearlo:** añadir `tinyjpg.com`, `tinypng.com` y `tinify.com` a *Allowed domains* en la
configuración de red del entorno y repetir los pasos de §6 (están preparados para reejecutarse).

## 2. Análisis con REA del cliente oficial `tinify` (npm 1.8.3, MIT)

Artefacto: `npm pack tinify@1.8.3` → `package/` (sha256 del árbol según REA:
`88ca513e360a4c9a75113ec64a8253cbd6fd4298fcad5528a25b02cd1739c4d1`).
Herramienta: `analyze_javascript_application` (MCP, evidence `ev_665fb869…`) y CLI
`rea analyze-javascript-application --json` → `docs/evidence/rea-tinify-nodejs-1.8.3.json.gz`.
REA parseó 18 ficheros JS sin ejecutarlos, sin fallos de parseo y con cobertura de aplicación `complete`.

Hallazgos confirmados (código distribuido, no ejecutado):

| Hallazgo | Ubicación | Tipo |
|---|---|---|
| Endpoint único `https://api.tinify.com`, auth HTTP Basic `api:<KEY>` | `lib/tinify/Client.js:17,100` | Confirmado (estático) |
| Compresión = `POST /shrink` con los bytes; el resultado se referencia por la cabecera `Location` | `lib/tinify/Source.js` (`fromFile`, `fromBuffer`) | Confirmado |
| Operaciones encadenables enviadas como JSON al `Location`: `preserve`, `resize`, `convert`, `transform`, `store` | `lib/tinify/Source.js` | Confirmado |
| Tipos de conversión: `image/webp`, `image/png`, `image/jpg`, `image/jpeg`, `image/jxl`, `image/avif` y comodín `*/*` | `lib/tinify/Source.d.ts:4-7` | Confirmado |
| Metadatos que se pueden conservar: `copyright`, `location`, `creation` | `README.md:15,70` | Confirmado (documentación del paquete) |
| `resize({ method: "cover", … })` y "Resize with intelligent cropping" | `README.md:13,53-55` | Confirmado que existe; semántica de recorte inteligente **no** verificable |
| Resultado expone `size`, `mediaType`, `extension`, `width`, `height` (cabeceras `image-width`/`image-height`) | `Result.js`, `ResultMeta.js` | Confirmado |
| Errores: 401/429 → `AccountError`; 4xx → `ClientError`; 5xx → `ServerError` con 1 reintento a los 500 ms | `Error.js`, `Client.js:51-104` | Confirmado |

Lo que **no** revela este análisis: el algoritmo del servidor. El cliente solo sube bytes y descarga
el resultado; la compresión ocurre en `api.tinify.com`. Observar una petición no equivale a entender el algoritmo.

## 3. Hipótesis sobre el algoritmo (no verificadas)

- PNG: fuentes de 2014 describen cuantización de color a paleta de 8 bits con alfa completo
  (estilo pngquant) y eliminación de metadatos. Hipótesis histórica; puede haber cambiado.
- JPEG ("smart compression"): no hay documentación técnica pública. Se presupone un ajuste de calidad por
  imagen; es una **hipótesis**, sin evidencia.
- AVIF/WebP/JXL: sin datos sobre parámetros.

Nuestra app no copia ese algoritmo: implementa una búsqueda de calidad por imagen con una métrica objetiva
(SSIM) usando códecs open source. Ver `architecture.md`.

## 4. Fuentes secundarias (WebSearch, solo snippets; NO observación directa)

| Afirmación | Fuente(s) | Fiabilidad |
|---|---|---|
| Zona de subida con el texto "Drop your images here!" | snippet de tinypng.com | Media (snippet de la propia web) |
| Web gratuita: hasta 20 imágenes, máx. 5 MB cada una | snippets de tinypng.com, us.fitgap.com, freetier.co | Media-alta (fuentes coinciden) |
| Conversión gratuita limitada a 3 imágenes | snippets de tinypng.com, freetier.co | Media |
| Formatos: AVIF, WebP, PNG, JPEG (compresión); destinos de conversión incl. JXL | snippet de tinypng.com, lafabriquedunet.fr; coincide con `Source.d.ts` | Media-alta |
| Botón "Download all images" | guía de terceros | Baja-media |
| Web Pro/Ultra de pago: 75 MB / 150 MB, conversiones ilimitadas en Ultra | blog de tinify.com (snippet), freetier.co | Media (precios contradictorios) |
| Límite diario de 20 | reseñas antiguas | Baja, no verificada |

URLs: https://tinypng.com/ · https://tinypng.com/web · https://tinify.com/developers/reference ·
https://tinify.com/blog/compress-convert-images-web-ultra · https://freetier.co/directory/products/tinypng ·
https://us.fitgap.com/products/tinypng · https://www.abeautifulsite.net/posts/tinypng-a-better-way-to-compress-png-images/ ·
https://t3n.de/news/tinypng-bilder-wenig-421853/ · https://www.lafabriquedunet.fr/logiciel/tinypng-tinyjpg

## 5. Gratuito frente a comercial (según lo que se pudo establecer)

- **Compresor web gratuito** (no observado directamente): subida múltiple, compresión, descarga individual y
  en bloque, conversión limitada. Límites: 20 imágenes, 5 MB, 3 conversiones.
- **De pago:** Web Pro/Ultra (archivos más grandes, más conversiones), API de desarrollador (`api.tinify.com`,
  con clave, `resize`, `preserve`, `store` en S3/GCS…), plugins y CDN. **No afirmamos** que resize o preserve
  estén en la web gratuita: solo está confirmado que existen en la API.

## 6. Qué no pudo determinarse y cómo completarlo

| Pendiente | Motivo | Paso reproducible cuando haya red |
|---|---|---|
| DOM, accesibilidad, estados y textos exactos de la UI | Red bloqueada | `capture_browser_scenario` con `at_end: ["dom","accessibility","screenshot"]` |
| Bundle JS, módulos y endpoints del compresor web | Red bloqueada | `analyze_web_bundle` y `trace_web_module_imports` |
| Peticiones al subir (upload → shrink → output) | Red bloqueada, necesitaría subir un archivo | `capture_browser_scenario` con eventos `network` |
| Benchmark comparativo contra TinyJPG | No se puede usar el servicio | subir `tests/fixtures/*` a mano y anotar tamaños en `benchmark-results.md` |
| Responsive y errores del original | Red bloqueada | capturas a 375/768/1280 px |

## 7. REA sobre el propio producto (verificación de privacidad)

`rea analyze-javascript-application dist/` (build de producción): 33 ficheros JS analizados sin ejecutar y
sin fallos de parseo. Resultado en `docs/evidence/rea-own-build-summary.json`:

- 34 construcciones de petición (`constructs-request`), **todas** en el código pegamento de los códecs
  (carga de `.wasm` del mismo origen); ninguna en el worker del motor.
- **0** URLs absolutas (`http(s)://…`) en todo el bundle.
- Limitación de REA detectada: no informó del `fetch(e.href)` del polyfill de `modulepreload` de Vite en el
  chunk de entrada (mismo origen), que encontré revisando a mano. La extracción de peticiones no es exhaustiva
  en código minificado. Por eso la garantía real viene de la prueba E2E de red y de la CSP (`connect-src 'self'`).

## 8. Hallazgos de la fase de desarrollo que conviene conocer

- La orientación EXIF depende del decodificador (MozJPEG WASM no la aplica y el navegador sí), y la
  arquitectura tiene que tratarla de forma explícita.
- Los decodificadores toleran JPEG truncados sin dar error. Hay que validarlos aparte.
- Una métrica SSIM a escala única castiga el dithering y el grano mucho más de lo que se percibe; con la
  versión multiescala, las decisiones cuadran mejor con lo que se ve.
