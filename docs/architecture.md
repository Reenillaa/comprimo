# Arquitectura de Comprimo

## Objetivo

Compresor y conversor de imágenes que funciona **entero en el navegador**. Las imágenes no salen del
equipo, no hay claves API, ni cuentas, ni límites de pago. Si se aloja, basta un hosting estático
(no necesita servidor de aplicación).

## Stack

| Capa | Elección | Por qué |
|---|---|---|
| UI | React 19 + TypeScript + Vite | Ecosistema estándar, build estático, soporte de workers y WASM sin configuración extra |
| Procesamiento | Web Workers (pool) | La interfaz no se bloquea; cancelar = `terminate()` del worker |
| Códecs | jSquash (códecs de Squoosh compilados a WASM) | Codificadores reales y mantenidos, Apache-2.0, funcionan en navegador y en Node (tests) |
| Cuantización PNG | Cuantizador propio (`quantize.ts`, MIT) | Median cut premultiplicado + k-means + Floyd–Steinberg amortiguado. Se probó image-q (MIT): ~1,2 s fijos por imagen por su histograma 4D, así que se descartó. libimagequant/pngquant es GPL-3 |
| ZIP | fflate (MIT) | Rápido, sin dependencias, modo *store* (las imágenes ya están comprimidas) |

### Evaluación de alternativas

- **libimagequant / pngquant**: la mejor calidad de cuantización, pero GPL-3 (o licencia comercial).
  Incompatible con una distribución MIT sin cambiar la licencia del proyecto → descartado.
- **Canvas `toBlob`**: no permite elegir codificador ni parámetros finos (no hay trellis de MozJPEG ni
  OxiPNG), y la salida varía según el navegador → solo se usa para decodificar.
- **WASM con hilos** (AVIF MT, OxiPNG paralelo): requiere aislamiento cross-origin (COOP/COEP). Se usa la
  variante de un solo hilo para que funcione en cualquier hosting estático; el paralelismo viene del pool.
- **Servidor con sharp/libvips**: obligaría a subir las imágenes (privacidad) y a pagar un servidor → descartado.

## Módulos

```
src/
  engine/                 # lógica pura, sin DOM; se prueba en Node
    sniff.ts              # tipo real por bytes mágicos, animación, dimensiones de cabecera
    resize-math.ts        # cálculo de dimensiones (scale, fit, cover, porcentaje)
    metrics.ts            # SSIM (luma) con soporte de alfa
    exif.ts               # segmentos JPEG: extraer EXIF/ICC, reescribir EXIF (Orientation=1, sin GPS)
    quantize.ts           # cuantización a paleta (propia)
    codecs.ts             # carga perezosa de los códecs WASM (inyectable para Node)
    strategies.ts         # estrategia por formato + búsqueda de calidad
    pipeline.ts           # decodificar → (redimensionar) → codificar → metadatos → resultado
    naming.ts, stats.ts   # nombres de salida, nombres únicos en el ZIP, ahorro
    types.ts
  worker/
    engine.worker.ts      # ejecuta el pipeline y reporta progreso por fases
    pool.ts               # cola + N workers, cancelación y reintentos
  ui/                     # componentes React
  app/                    # estado (reducer), hash de duplicados, ZIP
```

## Flujo

1. **Entrada** (drop o selector) → se leen los bytes → `sniff` determina el tipo real (no la extensión),
   si es animado y, si se puede, las dimensiones. Se calcula SHA-256 para detectar duplicados.
2. **Cola**: el pool reparte las tareas entre `min(4, núcleos-1)` workers. El `ArrayBuffer` se transfiere sin copiarlo.
3. **Decodificar** en el worker. JPEG/AVIF: `createImageBitmap` (convierte perfiles ICC a sRGB) →
   `OffscreenCanvas.getImageData`. PNG/WebP/JXL: decodificadores WASM (alfa sin premultiplicar, exacto).
   Antes, un JPEG sin marcador EOI se rechaza por truncado. Después, la **orientación EXIF se aplica de forma
   explícita** en el pipeline (igual en el navegador y en Node).
4. **Redimensionar** (opcional) con `@jsquash/resize` (Lanczos3, premultiplicado para no ensuciar los bordes con alfa).
5. **Codificar** según la estrategia del formato de salida:
   - **JPEG**: MozJPEG (trellis, tablas de cuantización optimizadas, progresivo). *Auto*: búsqueda binaria de
     la calidad mínima que alcanza el SSIM objetivo, medida sobre una muestra de ≤1 MP; después, una única
     codificación a resolución completa.
   - **PNG**: si tiene ≤256 colores → OxiPNG sin pérdida. Si no → cuantización a 256 (y luego 128; 64 en
     gráficos) colores con alfa, quedándose con la paleta más pequeña que alcanza el objetivo; si ni 256
     llega, OxiPNG sin pérdida.
   - **WebP**: libwebp con búsqueda de calidad (alfa con `alpha_quality` 100); con ≤1024 colores también prueba sin pérdida y elige el menor.
   - **Métrica**: SSIM en Y/Cb/Cr a 1×, ½× y ¼× (pesos 0,2/0,4/0,4); con alfa se compone sobre negro y blanco y se toma el peor.
   - **AVIF**: libavif (speed 6, 4:2:0, 4:4:4 si hay alfa o gráficos) con búsqueda de calidad.
   - **JXL**: libjxl (effort 7) con búsqueda de calidad.
   - **Auto-formato**: prueba los formatos candidatos y se queda con el más pequeño (alfa → nunca JPEG
     salvo que el usuario lo pida).
6. **Metadatos**: por defecto se eliminan (más pequeño y privado). Opción de conservar EXIF+ICC en JPEG→JPEG.
   La orientación ya está aplicada a los píxeles, así que se fija `Orientation=1`. El GPS se quita salvo que se pida.
7. **Resultado**: si el archivo resultante no es más pequeño y no hay conversión ni redimensionado, se
   ofrece el original (decisión explícita, visible en la UI).
8. **Descarga**: Blob URL por archivo; ZIP generado en el hilo principal con fflate (*store*). Las URLs se
   revocan al quitar el archivo o al limpiar la lista.

## Seguridad y privacidad

- Ninguna petición de red con datos del usuario. La CSP de `index.html` limita `connect-src` a `'self'` (los WASM).
- No se interpreta SVG ni HTML subido; solo se aceptan formatos ráster detectados por bytes mágicos.
- Sin telemetría, sin cookies, sin almacenamiento persistente de imágenes (solo `localStorage` para los ajustes).
- Tope técnico (no comercial) de 100 MP por imagen para evitar agotar la memoria WASM de 32 bits (4 GB);
  se explica en el error.

## Memoria

- Los workers liberan los `ImageData` al terminar cada tarea; el original se transfiere, no se copia.
- La búsqueda de calidad trabaja con una muestra reducida; solo la codificación final usa la imagen completa.
- Miniaturas: Blob URL del original (el navegador las decodifica y escala); se revocan al eliminar.

## Hosting

- Local: `npm run build && npm run preview` (gratis, sin dependencias externas).
- Público: cualquier hosting estático. **No se promete** alojamiento gratis ni coste cero de infraestructura:
  depende del proveedor que elijas.

## App de escritorio (Electron, macOS)

```
electron/
  main.cjs      # proceso principal: ventana, protocolo app://, menú, IPC validado
  preload.cjs   # puente mínimo (contextBridge) → window.comprimoDesktop
src/app/desktop.ts  # tipos del puente; undefined en la versión web
```

- **Misma interfaz** que la web: el build estático `dist/` se sirve desde un esquema privado
  `app://comprimo/` (estándar y seguro), así funcionan los workers ES y el `fetch` de los `.wasm`,
  también desde dentro de `app.asar`.
- **Aislamiento**: `contextIsolation`, `sandbox`, sin `nodeIntegration`; navegación y ventanas emergentes
  bloqueadas; todos los permisos web denegados.
- **Acceso a disco por lista blanca**: solo carpetas elegidas por el usuario en un diálogo nativo
  durante la sesión. `save` nunca sobrescribe (`flag: 'wx'` + "(2)") y limpia el nombre con `basename`
  (sin recorrido de rutas). `read` tiene un tope de 512 MB por archivo.
- **Modo sesión**: `fs.watch` de la carpeta elegida. Un archivo se entrega cuando su tamaño está estable
  durante 1,2 s (la cámara o el software de tethering escriben por partes). Se rechaza una salida dentro de
  la carpeta vigilada, o al revés, para no entrar en bucle.
- **Integración con macOS**: semáforos integrados (`hiddenInset`), vibrancy, menú de app (⌘O, ⌘⇧O, ⌘C/⌘V/⌘Q),
  progreso en el Dock y notificación al terminar un lote (solo si la ventana no está enfocada).
- **Ganchos de prueba** (solo por variable de entorno): `COMPRIMO_E2E_OUTPUT_DIR`, `COMPRIMO_E2E_WATCH_DIR`
  sustituyen el diálogo nativo y `COMPRIMO_USER_DATA` usa un perfil temporal.
- **Empaquetado**: `scripts/package-mac.mjs` (@electron/packager) → `Comprimo.app` arm64 y x64, firma ad-hoc,
  zip que conserva los symlinks. Sin notarizar (requiere cuenta de Apple Developer).
- **Miniaturas**: el worker devuelve un WebP de 512 px con cada resultado, para que una galería de cientos
  de fotos de 24 MP no obligue a decodificar los originales en la interfaz.
