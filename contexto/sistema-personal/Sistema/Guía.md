---
tipo: guia
---
## Una vez (2 minutos)
1. **Ajustes → Plugins del núcleo**: activa **Bases** y **Plantillas** (vienen con Obsidian, no son de la comunidad).
2. **Ajustes → Plantillas → Ubicación de la carpeta**: `Sistema/Plantillas`.
3. Opcional: fija [[Inicio]] como pestaña de inicio (clic derecho en la pestaña → *Fijar*).

## Propiedades (las mismas en todas las notas)
| Propiedad | Valores | Para qué |
|---|---|---|
| `tipo` | asignatura · apunte · concepto · idea · aprendizaje · recurso | Las vistas filtran por esto, no por carpeta: puedes mover notas sin romper nada |
| `asignatura` | `[[Nombre de la asignatura]]` | Agrupa apuntes y conceptos |
| `estado` | pendiente · estudiando · comprendido · repasar | Dónde estás con cada tema |
| `proximo_repaso` | fecha | Cuándo volver a mirarlo (opcional) |
| `intervalo` | días: 1 → 3 → 7 → 14 → 30 | Si al repasar lo sabes, dobla el intervalo y suma la fecha |
| `notion` | URL | Enlace a la ficha de Notion (partido, sesión, asignatura) |

## Estados de estudio
- **pendiente**: está en el temario, aún no lo he tocado.
- **estudiando**: lo estoy trabajando.
- **comprendido**: lo entiendo; si quiero que no se me olvide, le pongo `proximo_repaso`.
- **repasar**: lo entendí, pero flojea. Aparece en *Repasar hoy* cuando toca.

## Repaso espaciado (ligero, sin plugins)
Al repasar una nota de *Repasar hoy*:
- **La sabía** → `intervalo` ×2 y `proximo_repaso` = hoy + intervalo.
- **No la sabía** → `estado: repasar`, `intervalo: 1` y `proximo_repaso` = mañana.

Si no te apetece usarlo, ignóralo: nada se rompe.

## Qué NO va aquí
- Tareas y fechas límite → **Notion**.
- Horarios, partidos y clases con hora → **Calendario**.
- Fotos → tu disco. Aquí solo enlaces.
