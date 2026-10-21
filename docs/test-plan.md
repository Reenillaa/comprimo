# Plan de pruebas

Estado de cada prueba (completada, fallida o pendiente) en `docs/test-results.md`, que se rellena
tras ejecutarlas.

## Fixtures (`tests/fixtures`, generados con `npm run fixtures`)

Se generan con sharp/libvips a partir de fuentes con licencia libre (imágenes de muestra de scikit-image,
CC0/dominio público) y de patrones sintéticos con valores conocidos:

| Fixture | Caso |
|---|---|
| `photo-large.jpg` | Fotografía de alta resolución (≥ 3000 px), q=95 |
| `photo-noise.jpg` | Ruido y detalle fino |
| `photo-exif.jpg` | EXIF con Orientation=6, Copyright y GPS |
| `alpha.png` | RGBA con degradado de transparencia |
| `flat-graphic.png` | Colores planos y texto (≤256 colores) |
| `photo.png` | Fotografía en PNG de 24 bits |
| `photo.webp`, `alpha.webp` | WebP con pérdida y con alfa |
| `photo.avif` | AVIF |
| `tiny.png` | 1×1 |
| `already-optimal.png` | PNG que no se puede mejorar |
| `truncated.jpg` | JPEG cortado a la mitad |
| `fake.jpg` | Texto con extensión .jpg |
| `animated.png` | APNG (2 fotogramas) |
| `mislabeled.jpg` | PNG con extensión .jpg |

## Unitarias (Vitest, Node)

- `sniff`: tipos por bytes mágicos, APNG/WebP animado, dimensiones de cabecera, entradas basura.
- `resize-math`: scale, fit, cover, porcentaje, no ampliar, mínimos de 1 px.
- `exif`: extraer EXIF/ICC; reescritura con Orientation=1, sin GPS, conservando Copyright; reinyección en un JPEG válido.
- `naming`: extensión correcta según el formato real, nombres únicos en el ZIP, caracteres raros.
- `stats`: bytes y porcentaje de ahorro, totales del lote, resultado mayor que el original.
- `metrics`: SSIM(imagen, imagen) = 1; SSIM baja con ruido; con alfa.

## Integración (Vitest, Node, códecs WASM reales)

Para cada formato admitido: decodificar fixture → pipeline → decodificar la salida con un decodificador
**independiente** (sharp/libvips) y comprobar:
- formato real de la salida (firma),
- dimensiones esperadas,
- transparencia conservada (píxel con alfa 0 sigue a 0),
- SSIM respecto al original ≥ umbral,
- tamaño reportado = `byteLength` real,
- conversiones (PNG→WebP, PNG→JPEG con fondo, JPEG→AVIF, →JXL),
- auto-formato elige el candidato más pequeño,
- resultado mayor que el original → se marca `larger` y se ofrece el original,
- metadatos: JPEG con "conservar" mantiene Copyright y pierde GPS; por defecto no hay EXIF.

## Navegador (Playwright, Chromium, build de producción)

- Subida con el selector y con drag & drop sintético (DataTransfer).
- Lote de varios formatos; todos acaban en "Terminado" o en un error esperado.
- Descarga individual: nombre y bytes = tamaño mostrado.
- Descargar todo: el ZIP se abre (fflate en Node) y tiene N entradas decodificables.
- Duplicado detectado.
- Cancelar y reintentar.
- Archivo dañado, no admitido o animado → mensaje concreto.
- Comparador antes/después con teclado.
- Flujo completo con teclado; `aria-live` anuncia el progreso.
- Responsive: 375×812 sin scroll horizontal; 1280×800.
- Red: todas las peticiones van a `localhost` (sin APIs comerciales).
- Sin textos de pago ("Pro", "upgrade", "subscription", "premium", "créditos").

## Benchmark (`npm run bench`)

Tamaños de entrada y salida, SSIM y tiempos de Comprimo (motor en Node) frente a referencias
**reproducibles locales** (libvips/sharp con calidad fija). La comparación con TinyJPG queda **pendiente**
porque el servicio no es accesible desde este entorno.
