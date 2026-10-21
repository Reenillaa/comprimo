<!-- Generado por `npm run bench`. No editar a mano. -->
Generado: 2026-10-21T00:32:42.849Z · Node v22.22.0 · linux/x64 · motor en un solo hilo

| Archivo | Codificador | Entrada (kB) | Salida (kB) | Ahorro | Similitud* | Ajuste elegido | Tiempo (ms) |
|---|---|---|---|---|---|---|---|
| photo-large.jpg | Comprimo (web) | 1853.3 | 251.6 | 86.4 % | 0.9818 | q45 | 4437 |
| photo-large.jpg | Comprimo (photo) | 1853.3 | 338.7 | 81.7 % | 0.9857 | q64 | 4512 |
| photo-large.jpg | Referencia (libvips mozjpeg q80) | 1853.3 | 519.9 | 71.9 % | 0.9932 | fija | 651 |
| photo-large.jpg | TinyJPG/TinyPNG | 1853.3 | — | — | — | no medido (servicio inaccesible desde el entorno) | — |
| photo-noise.jpg | Comprimo (web) | 128.0 | 125.4 | 2.0 % | 0.9830 | q90 | 1376 |
| photo-noise.jpg | Comprimo (photo) | 128.0 | 128.0 | 0.0 % | 1.0000 | original conservado | 1391 |
| photo-noise.jpg | Referencia (libvips mozjpeg q80) | 128.0 | 56.3 | 56.0 % | 0.9572 | fija | 62 |
| photo-noise.jpg | TinyJPG/TinyPNG | 128.0 | — | — | — | no medido (servicio inaccesible desde el entorno) | — |
| photo-exif.jpg | Comprimo (web) | 38.3 | 12.1 | 68.4 % | 0.9809 | q61 | 366 |
| photo-exif.jpg | Comprimo (photo) | 38.3 | 17.4 | 54.5 % | 0.9889 | q77 | 427 |
| photo-exif.jpg | Referencia (libvips mozjpeg q80) | 38.3 | 19.0 | 50.4 % | 0.9904 | fija | 35 |
| photo-exif.jpg | TinyJPG/TinyPNG | 38.3 | — | — | — | no medido (servicio inaccesible desde el entorno) | — |
| photo.png | Comprimo (web) | 332.6 | 75.6 | 77.3 % | 0.9867 | 128 colores | 1277 |
| photo.png | Comprimo (photo) | 332.6 | 90.4 | 72.8 % | 0.9895 | 256 colores | 1425 |
| photo.png | Referencia (libvips paleta q80) | 332.6 | 85.7 | 74.2 % | 0.9946 | fija | 251 |
| photo.png | TinyJPG/TinyPNG | 332.6 | — | — | — | no medido (servicio inaccesible desde el entorno) | — |
| alpha.png | Comprimo (web) | 751.5 | 343.5 | 54.3 % | 1.0000 | sin pérdida | 1710 |
| alpha.png | Comprimo (photo) | 751.5 | 343.5 | 54.3 % | 1.0000 | sin pérdida | 1638 |
| alpha.png | Referencia (libvips paleta q80) | 751.5 | 71.7 | 90.5 % | 0.9648 | fija | 1167 |
| alpha.png | TinyJPG/TinyPNG | 751.5 | — | — | — | no medido (servicio inaccesible desde el entorno) | — |
| flat-graphic.png | Comprimo (web) | 21.8 | 5.0 | 77.0 % | 1.0000 | 128 colores | 749 |
| flat-graphic.png | Comprimo (photo) | 21.8 | 5.0 | 77.0 % | 1.0000 | 128 colores | 754 |
| flat-graphic.png | Referencia (libvips paleta q80) | 21.8 | 4.1 | 81.0 % | 0.9999 | fija | 46 |
| flat-graphic.png | TinyJPG/TinyPNG | 21.8 | — | — | — | no medido (servicio inaccesible desde el entorno) | — |
| photo.webp | Comprimo (web) | 71.3 | 27.2 | 61.9 % | 0.9803 | q64 | 714 |
| photo.webp | Comprimo (photo) | 71.3 | 39.2 | 44.9 % | 0.9884 | q82 | 642 |
| photo.webp | Referencia (libvips WebP q80) | 71.3 | 35.6 | 50.1 % | 0.9869 | fija | 50 |
| photo.webp | TinyJPG/TinyPNG | 71.3 | — | — | — | no medido (servicio inaccesible desde el entorno) | — |
| alpha.webp | Comprimo (web) | 61.7 | 21.1 | 65.8 % | 0.9905 | q40 | 1183 |
| alpha.webp | Comprimo (photo) | 61.7 | 21.1 | 65.8 % | 0.9905 | q40 | 1123 |
| alpha.webp | Referencia (libvips WebP q80) | 61.7 | 30.4 | 50.7 % | 0.9955 | fija | 148 |
| alpha.webp | TinyJPG/TinyPNG | 61.7 | — | — | — | no medido (servicio inaccesible desde el entorno) | — |
| photo.avif | Comprimo (web) | 43.8 | 12.9 | 70.5 % | 0.9813 | q41 | 4820 |
| photo.avif | Comprimo (photo) | 43.8 | 19.9 | 54.6 % | 0.9885 | q54 | 4759 |
| photo.avif | Referencia (libvips AVIF q50) | 43.8 | 16.4 | 62.5 % | 0.9893 | fija | 1397 |
| photo.avif | TinyJPG/TinyPNG | 43.8 | — | — | — | no medido (servicio inaccesible desde el entorno) | — |
| already-small.jpg | Comprimo (web) | 6.5 | 6.5 | 0.0 % | 1.0000 | original conservado | 267 |
| already-small.jpg | Comprimo (photo) | 6.5 | 6.5 | 0.0 % | 1.0000 | original conservado | 257 |
| already-small.jpg | Referencia (libvips mozjpeg q80) | 6.5 | 9.0 | -38.4 % | 0.9991 | fija | 16 |
| already-small.jpg | TinyJPG/TinyPNG | 6.5 | — | — | — | no medido (servicio inaccesible desde el entorno) | — |

\* SSIM multiescala de Comprimo calculado sobre píxeles decodificados por **libvips** (decodificador independiente), 1 = idéntico.
