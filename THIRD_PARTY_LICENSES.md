# Dependencias y licencias

## Incluidas en la aplicación (se distribuyen en `dist/`)

| Paquete | Versión | Licencia | Contiene | Obligaciones |
|---|---|---|---|---|
| react, react-dom, scheduler | 19.3.1 / 0.28.0 | MIT | UI | Conservar el aviso de copyright |
| @jsquash/jpeg | 1.6.0 | Apache-2.0 | MozJPEG (IJG + BSD-3, partes zlib) compilado a WASM | Apache-2.0: incluir licencia y NOTICE; IJG: reconocer el uso de "the Independent JPEG Group's software" |
| @jsquash/png | 3.1.1 | Apache-2.0 | Códec PNG de Squoosh (crate `png`, MIT/Apache-2.0) | Incluir licencia |
| @jsquash/oxipng | 2.3.0 | Apache-2.0 | OxiPNG (MIT) | Incluir licencia |
| @jsquash/webp | 1.5.0 | Apache-2.0 | libwebp (BSD-3-Clause) | Incluir aviso BSD |
| @jsquash/avif | 2.1.1 | Apache-2.0 | libavif (BSD-2), libaom (BSD-2 + AOM Patent License 1.0) | Incluir avisos BSD; la licencia de patentes de AOM es libre de regalías |
| @jsquash/jxl | 1.3.0 | Apache-2.0 | libjxl (BSD-3-Clause) | Incluir aviso BSD |
| @jsquash/resize | 2.1.1 | Apache-2.0 | Redimensionado de Squoosh (Rust, MIT/Apache-2.0) | Incluir licencia |
| wasm-feature-detect | 1.9.0 | Apache-2.0 | Detección de SIMD e hilos | Incluir licencia |
| fflate | 0.8.3 | MIT | Generación de ZIP | Conservar el aviso |
| tslib | 2.8.1 | 0BSD | Helpers | Ninguna |

`npm run build` copia automáticamente los textos de licencia de estos paquetes a `dist/licenses/`
(con un `INDEX.txt`). **Pendiente conocido:** los paquetes npm de jSquash solo traen su propia licencia
Apache-2.0, no los avisos de las bibliotecas C/Rust que compilan (MozJPEG, libwebp, libavif, libaom,
libjxl, OxiPNG). Antes de publicar el sitio, añade esos avisos a `dist/licenses/` desde sus repositorios
oficiales.

El cuantizador de paleta PNG (`src/engine/quantize.ts`) es código propio del proyecto (MIT): **no** usa
libimagequant/pngquant, que son GPL-3.

## Solo para desarrollo y pruebas (no se distribuyen)

| Paquete | Licencia | Uso |
|---|---|---|
| vite, @vitejs/plugin-react, vitest | MIT | Build y tests |
| typescript | Apache-2.0 | Tipos |
| @playwright/test | Apache-2.0 | Tests de navegador |
| @axe-core/playwright, axe-core | MPL-2.0 | Auditoría de accesibilidad |
| sharp (libvips) | Apache-2.0 (binarios con LGPL-3.0) | Fixtures, decodificador independiente en tests y referencia del benchmark |
| rea-agents (REA) | MIT | Investigación (instalado de forma global, no es dependencia del proyecto) |

## Datos de prueba

`tests/fixtures/sources/`: imágenes de muestra de scikit-image (NASA, dominio público; CC0). Ver
`tests/fixtures/sources/LICENSES.md`.

## Servicios externos

Ninguno. No hay API de pago, ni claves, ni telemetría, ni CDN de terceros.
