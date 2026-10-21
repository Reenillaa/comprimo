# Fuentes de los fixtures

Imágenes de muestra de scikit-image (`skimage/data`, wheel de PyPI), con estas condiciones según su documentación:

| Archivo | Licencia / origen |
|---|---|
| astronaut.png | NASA Great Images; sin restricciones de copyright conocidas, dominio público |
| coffee.png | CC0, Rachel Michetti |
| chelsea.png | CC0, Stefan van der Walt |
| rocket.jpg | SpaceX, publicada en el dominio público |

El resto de fixtures (`../*.jpg|png|webp|avif`) se generan con `npm run fixtures` a partir de estas
imágenes o de patrones sintéticos.
