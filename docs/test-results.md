# Resultados de las pruebas

Última ejecución: 2026-10-21, contenedor Linux x64, Node 22.22.0, Chromium 141 (Playwright 1.56.1).

## Resumen

| Suite | Comando | Resultado |
|---|---|---|
| Unitarias (7 archivos con integración) | `npm test` | **106/106 superadas** |
| Navegador (build de producción) | `npm run test:e2e` | **15/15 superadas** |
| Typecheck | `tsc -p tsconfig.json` | sin errores |
| Benchmark | `npm run bench` | ejecutado → `benchmark-data.md` |

## Cobertura frente al plan

| Requisito | Estado | Prueba |
|---|---|---|
| Subida por selector | ✅ Completada | e2e "selector múltiple…" |
| Drag and drop | ✅ Completada | e2e "arrastrar y soltar" (DataTransfer real) |
| Varios archivos / lote sin límite | ✅ Completada | e2e "lote grande… (25 imágenes)" |
| Procesamiento real de JPEG, PNG, WebP, AVIF | ✅ Completada | integración (8 casos) + e2e (descarga decodificada por libvips) |
| JPEG XL | ✅ Completada (salida) | integración: libjxl decodifica la salida. Vista previa depende del navegador (Chromium no lo muestra) |
| Orientación EXIF | ✅ Completada | unitarias (8 orientaciones), integración y e2e con comparación píxel a píxel |
| Fidelidad visual | ✅ Completada | similitud > 0,95 con decodificador independiente (libvips) |
| Transparencia | ✅ Completada | integración: píxeles con alfa 0 siguen a 0; PNG→WebP mantiene el alfa |
| Conversión efectiva | ✅ Completada | integración JPEG→WebP/AVIF/JXL/PNG/JPEG; e2e PNG→WebP con firma RIFF/WEBP |
| Redimensionado | ✅ Completada | unitarias (planResize) + integración (fit, cover, %, scale) + e2e |
| Tamaño y % de ahorro | ✅ Completada | e2e: tamaño mostrado = bytes descargados; % coincide |
| Descargas individuales y nombres | ✅ Completada | e2e (nombre sugerido, extensión real) |
| ZIP: generación y apertura | ✅ Completada | e2e: se descomprime con fflate y cada entrada la decodifica libvips |
| Nombres duplicados en el ZIP | ✅ Completada | e2e "ZIP con nombres repetidos…" |
| Archivos duplicados | ✅ Completada | e2e (mismo contenido con otro nombre → "duplicado") |
| Cancelación y reintento | ✅ Completada | e2e (AVIF de 7 MP cancelado y reintentado) + unitarias del pool |
| Recuperación de errores / caída del worker | ✅ Completada (simulada) | unitarias del pool con worker falso que "se cae" |
| Archivos dañados, truncados, no admitidos, animados | ✅ Completada | integración + e2e |
| Imágenes enormes / tope de memoria | ⚠️ Parcial | probado el rechazo por cabecera (>100 MP). **No** probada una imagen real cercana al límite en navegador ni un fallo real de memoria |
| Accesibilidad | ✅ Completada | axe-core sin violaciones serias/críticas (vacío y con resultados); flujo con teclado; comparador con flechas |
| Responsive | ✅ Completada | e2e a 375 px sin scroll horizontal; capturas en `docs/screenshots/` |
| Sin llamadas a APIs comerciales | ✅ Completada | e2e: todas las peticiones a 127.0.0.1/blob; la CSP bloquea `api.tinify.com`; REA sobre el build (ver `evidence/rea-own-build-summary.json`) |
| Sin bloqueos de pago | ✅ Completada | e2e: sin textos de pago |
| Firefox / Safari | ❌ Pendiente | solo hay Chromium en el entorno |
| Comparación con TinyJPG | ❌ Pendiente | servicio inaccesible (red bloqueada) |

## Fallos encontrados por las pruebas y corregidos

1. **El cuantizador "contaminaba" de alfa los píxeles transparentes** (el dithering les metía alfa 12 → halos). Arreglado con una entrada de paleta reservada para el transparente y sin difundir error de alfa en píxeles opacos o transparentes.
2. **Un JPEG truncado se comprimía como si estuviera bien** (MozJPEG rellena de gris lo que falta). Arreglado con detección de EOI tras el SOS.
3. **Orientación EXIF dependiente del entorno**: el decodificador WASM no la aplicaba y el navegador sí. Ahora el pipeline rota los píxeles explícitamente (8 orientaciones probadas).
4. **Nombre accesible duplicado** ("Elegir imágenes" en el botón y en el `<input>` oculto). Arreglado.
5. **La miniatura de un archivo no válido provocaba una violación de la CSP**: ya no se pasa contenido sin validar a `<img>`.
6. Fixture de EXIF mal generado (sharp ignoraba `Orientation` en `withExif`). Corregido.
7. **Doble rotación en el navegador** (lo destaparon las capturas, no los tests): Chromium trata hoy
   `imageOrientation: 'none'` como `'from-image'`, así que la foto se giraba dos veces. Ahora el decodificador
   declara `oriented` y el pipeline solo rota si hace falta. Se añadió un E2E que compara píxel a píxel con
   `autoOrient` de libvips.
