# Resultados de compresión (medidos)

Datos completos y reproducibles en [`benchmark-data.md`](benchmark-data.md), generados con `npm run bench`
(motor real de Comprimo en Node, códecs WASM idénticos a los del navegador, un solo hilo).
La similitud se calcula sobre píxeles decodificados por **libvips**, un decodificador independiente de los códecs evaluados.

## Comparación con TinyJPG/TinyPNG: **no medida**

El servicio no es accesible desde el entorno de desarrollo (política de red: `tinyjpg.com`,
`tinypng.com` y `tinify.com` están bloqueados; ver `research.md`). **No hay ninguna cifra de TinyJPG en
este proyecto** y no se afirma equivalencia con él. Para completarla: subir a mano los archivos de
`tests/fixtures/` a tinyjpg.com, anotar los tamaños de salida y medir la similitud con el mismo script
(basta con añadir los archivos descargados a una carpeta y adaptar `reference()` en
`tests/bench/compression.bench.test.ts`).

## Comparación con una referencia local reproducible

Referencia: libvips (sharp 0.35) con **calidad fija** (MozJPEG q80, paleta libimagequant q80, WebP q80,
AVIF q50). No es TinyJPG; sirve para comprobar que el modo automático compite con una configuración
"razonable" típica.

| Caso | Comprimo (web) | Referencia fija | Lectura |
|---|---|---|---|
| Foto JPEG 3072×2304 (mosaico ampliado) | −86,4 % · 0,982 | −71,9 % · 0,993 | La búsqueda baja a q45: la imagen ampliada es muy suave y lo tolera. El perfil Fotografía da −81,7 % con q64. |
| Foto JPEG 451×300 con EXIF | −68,4 % · 0,981 | −50,4 % · 0,990 | Más ahorro con una similitud algo menor, dentro del objetivo. |
| Foto con mucho ruido | −2,0 % · 0,983 | −56,0 % · 0,957 | **Debilidad**: el SSIM castiga perder el grano, así que el modo auto casi no comprime. La referencia ahorra mucho más, pero borra ruido (0,957). |
| JPEG ya muy comprimido (q30) | 0 % (original conservado) | **+38,4 %** (crece) | Comprimo no entrega nunca un archivo más grande sin avisar. |
| Foto PNG 24 bits | −77,3 % · 0,987 (128 colores) | −74,2 % · 0,995 | Comparable. |
| PNG con degradado de alfa sobre foto | −54,3 % · 1,000 (sin pérdida) | −90,5 % · 0,965 | **Debilidad**: la paleta no alcanza el objetivo de similitud y se cae a sin pérdida. Exportar a WebP (o el modo automático) da −90 % y más. |
| Gráfico plano con texto | −77,0 % · 1,000 | −81,0 % · 1,000 | Comparable; libimagequant comprime un poco mejor. |
| WebP foto | −61,9 % · 0,980 | −50,1 % · 0,987 | Más ahorro. |
| WebP con alfa | −65,8 % · 0,991 | −50,7 % · 0,996 | Más ahorro. |
| AVIF | −70,5 % · 0,981 | −62,5 % · 0,989 | Más ahorro, pero codificar es lento (~5 s por imagen de 512×512 en un hilo). |

## Rendimiento (Node 22, un hilo, este contenedor)

- JPEG 7 MP: ~4,5 s (6 codificaciones de muestra + 1 completa + verificación).
- PNG 0,14 MP con cuantización: ~1,3 s. AVIF 0,26 MP: ~4,8 s.
- En el navegador se procesan hasta `min(4, núcleos − 1)` imágenes en paralelo (una por worker).

## Calibración de umbrales

Los objetivos de similitud (`TARGETS` en `src/engine/strategies.ts`) se fijaron midiendo SSIM frente a la
calidad sobre estos fixtures: web 0,980, fotografía 0,988, transparencia 0,982, gráficos 0,990. Con una
foto real (photo.png → JPEG), el perfil web cae alrededor de MozJPEG q60–65 y el de fotografía alrededor de q75–80.
Son valores empíricos sobre un conjunto pequeño (10 imágenes): conviene revisarlos con un corpus mayor.
