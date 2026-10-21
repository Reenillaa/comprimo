# Matriz de funciones

Leyenda de evidencia: **REA** = análisis REA del cliente oficial `tinify` 1.8.3 (código distribuido) ·
**WS** = snippet de búsqueda web (no observado) · **—** = sin evidencia del original (función propia o mejora).
Ninguna fila se basa en observación directa de tinyjpg.com: la red del entorno lo bloquea (ver `research.md`).

| Función | Evidencia | Comportamiento observado | Implementación propuesta | Prueba de aceptación |
|---|---|---|---|---|
| Zona de arrastrar y soltar | WS ("Drop your images here!") | No observado; solo el texto vía snippet | Zona grande con `dragover`/`drop`, foco visible, también se puede activar con teclado | E2E: un `drop` sintético con 2 archivos crea 2 filas |
| Selector de archivos | WS (implícito) | No observado | `<input type=file multiple accept=…>` dentro de la zona; Enter/Espacio lo abre | E2E: `setInputFiles` con 3 archivos → 3 resultados |
| Selección múltiple / lotes | WS (20 imágenes) | Límite de 20 en el gratuito | Sin límite; cola con concurrencia = núcleos (máx. 4) | E2E: 25 archivos se procesan todos |
| Límite de tamaño | WS (5 MB) | 5 MB en el gratuito | Sin límite artificial; tope técnico por memoria de 100 MP, explicado | Unit: 120 MP → error claro; 25 MB → se procesa |
| Compresión JPEG | WS + REA (`/shrink`) | Algoritmo del servidor desconocido | MozJPEG con búsqueda de calidad por SSIM | Integración: el JPEG baja de tamaño, SSIM ≥ umbral |
| Compresión PNG | WS (hipótesis: cuantización) | Desconocido | Cuantización propia a ≤256 colores con alfa + OxiPNG; sin pérdida si la calidad no llega | Integración: PNG con alfa sigue con alfa y pesa menos |
| Compresión WebP | WS + REA (tipo `image/webp`) | Desconocido | libwebp con búsqueda de calidad; alfa conservado | Integración: WebP válido, más pequeño |
| Compresión AVIF | WS + REA (`image/avif`) | Desconocido | libavif (speed 6) con búsqueda de calidad | Integración: AVIF válido |
| JPEG XL | REA (`image/jxl` en `Source.d.ts`) | Existe como destino de conversión en la API | libjxl vía jSquash; marcado "beta"; vista previa solo si el navegador lo decodifica | Integración: JXL decodificable por libjxl |
| Conversión de formato | REA (`convert({type})`) + WS (3 gratis) | API: lista de tipos o `*/*` | Selector de salida: original, JPEG, PNG, WebP, AVIF, JXL; gratis e ilimitado | E2E: PNG → WebP descarga `.webp` con firma RIFF/WEBP |
| Formato automático (el más pequeño) | REA (comodín `*/*`) | API; semántica de "el más pequeño" no verificada | Modo "Automático": codifica en los candidatos y se queda con el más pequeño | Integración: el elegido es ≤ que los demás candidatos |
| Fondo al quitar transparencia | REA (`transform`) | API; parámetros no verificados | Color de fondo configurable al convertir alfa → JPEG, con aviso | Integración: PNG transparente → JPEG con fondo blanco |
| Redimensionar: escalar | REA (`resize`) | Solo API | Ancho **o** alto, manteniendo proporción | Unit: 4000×3000, ancho 1000 → 1000×750 |
| Redimensionar: encajar (fit) | REA/WS | Solo API | Caja ancho×alto, sin ampliar | Unit: 4000×3000 en 800×800 → 800×600 |
| Redimensionar: cubrir (cover) | REA (`method:"cover"`) | Solo API; recorte "inteligente" no verificable | Escala y recorte centrado (no se afirma que sea inteligente) | Unit + integración: dimensiones exactas |
| Redimensionar por porcentaje | — | — | Porcentaje 1–100 | Unit: 50 % de 1001×601 → 501×301 |
| Calidad manual | — | — | Modo avanzado: deslizador de calidad por formato | Integración: q=40 pesa menos que q=90 |
| Conservar metadatos | REA (`preserve copyright/location/creation`) | Solo API | JPEG→JPEG: EXIF (Orientation a 1, GPS quitado salvo que se pida) + ICC; otros formatos: aviso | Unit: el EXIF reescrito conserva Copyright y pierde GPS |
| Conservar transparencia | WS (PNG con alfa) | Afirmado por terceros | Alfa preservado en PNG, WebP, AVIF y JXL | Integración: píxel transparente sigue transparente |
| Tamaño original / final / % | WS | Se muestra en la lista | Bytes reales de los Blobs; % = 1 − final/original | Unit: cálculo; E2E: el % mostrado coincide con los bytes descargados |
| Resultado mayor que el original | — | Desconocido | Aviso "No se pudo reducir"; por defecto se ofrece el original | Integración: un PNG ya óptimo → se conserva el original |
| Descarga individual | WS | Enlace por archivo | `<a download>` con Blob URL, nombre con la extensión real | E2E: el evento `download` trae el nombre y los bytes correctos |
| Descargar todo (ZIP) | WS ("Download all images") | Existe en el gratuito según terceros | ZIP en local con fflate; nombres sin duplicados | E2E: el ZIP se abre y contiene N entradas válidas |
| Comparación antes/después | — | No hay evidencia de que exista en el original | Diálogo con deslizador (teclado y ratón) | E2E: el diálogo se abre y el deslizador responde a las flechas |
| Estados: cola / procesando / hecho / error | WS (barra de progreso) | No observado | Estados por fila con barra de progreso por fases reales | E2E: archivo corrupto → estado de error con mensaje |
| Validación de formato | — | No observado | Detección por bytes mágicos, no por extensión | Unit: un `.jpg` que en realidad es PNG se detecta como PNG |
| Archivos dañados | — | No observado | Error concreto ("archivo dañado o truncado") | E2E: JPEG truncado → error |
| Formatos no admitidos | — | No observado | Mensaje con los formatos admitidos (GIF/SVG/BMP rechazados) | E2E: un `.txt` → error claro |
| Animación (APNG/WebP animado) | — | No observado | Detectar y rechazar con explicación (no se aplana a escondidas) | Unit: un APNG (acTL) se detecta como animado |
| Duplicados | — | — | SHA-256 del contenido; se marca y se reutiliza el resultado | E2E: el mismo archivo dos veces → aviso de duplicado |
| Cancelar | — | — | Cancelar uno o todos (termina el worker) | E2E: cancelar durante el proceso → estado "cancelado" |
| Reintentar | — | — | Botón de reintento en errores o cancelados | E2E: reintentar tras cancelar → terminado |
| Ahorro total del lote | WS ("…saved you X%") | Texto con el ahorro total | Panel de resumen con bytes y % reales | Unit: suma; E2E: el total coincide |
| Privacidad | — | El original se sube al servidor de Tinify (REA: `POST /shrink`) | 100 % local; sin peticiones de red con imágenes | E2E: ninguna petición fuera de localhost |
| Accesibilidad | — | No observado | Roles ARIA, `aria-live`, foco, teclado, contraste AA | E2E: flujo completo solo con teclado |
| Responsive | — | No observado | Layout fluido de 320 a 1440 px | E2E: a 375 px sin scroll horizontal |
| Planes de pago / límites | WS (Pro/Ultra) | Existen | **No existen** en Comprimo | E2E: no aparecen textos de pago |
