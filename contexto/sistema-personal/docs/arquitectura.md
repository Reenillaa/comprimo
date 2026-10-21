# Arquitectura del sistema personal

## Principio: cada dato vive en un solo sitio

| Tipo de dato | Fuente de verdad | Se ve también en | Por qué |
|---|---|---|---|
| Compromisos con hora fija (clases, partidos, sesiones, exámenes, eventos) | **Google Calendar** | Notion Calendar, móvil | Es lo que te avisa y lo que ves en el móvil. Las horas no se copian a mano en otro sitio. |
| Tareas, proyectos, trabajos fotográficos, publicaciones, entregas y exámenes (estado y seguimiento) | **Notion** | Notion Calendar (por fecha) | Bases de datos relacionadas, vistas filtradas y estados. |
| Apuntes, conceptos, conocimiento técnico e ideas largas | **Obsidian** | Enlace desde Notion | Texto propio, enlaces entre conceptos, archivos locales que te pertenecen. |
| Fotografías | **Tu disco o almacenamiento actual** | Enlace (carpeta o galería) en Notion | No se duplican fotos dentro de Notion ni de Obsidian. |

**Puentes entre apps** (enlaces, nunca copias):
- Una ficha de Notion (partido, sesión, asignatura) guarda la URL de su nota de Obsidian y del evento de Calendar.
- Una nota de Obsidian guarda en `notion:` la URL de la ficha de Notion.
- **Notion Calendar** (gratis, oficial) muestra juntos Google Calendar y las fechas de las bases de Notion. Así no hace falta ninguna sincronización ni servicio externo.

**Sincronización: decisión.** No se monta sincronización bidireccional Notion↔Calendar: es la principal fuente de duplicados y bucles. Si un elemento tiene hora fija, se crea **un** evento en Google Calendar y su URL se guarda en la ficha de Notion. Lo demás se ve en Notion Calendar sin copiarlo.

## Fechas: dos tipos, nunca mezclados

- **Fecha límite**: real, externa (entrega del trabajo, examen, entrega al cliente). No se mueve.
- **Planificada**: el día que *tú* decides hacerlo. Se mueve sin culpa.

La vista **Hoy** usa la planificada. Las alertas de atraso, solo la límite.

## Modelo de datos (Notion)

```
Tareas ──┬── Proyecto (Trabajos foto | Proyectos)
         └── Asignatura
Trabajos foto (partido | sesión) ──┬── Cliente/Contacto
                                   ├── Publicaciones
                                   └── Tareas
Asignaturas ──┬── Evaluaciones (examen | trabajo | práctica)
              └── Tareas
Publicaciones ── Trabajo foto
```

| Base | Para qué | Propiedades (solo las que se mantienen) |
|---|---|---|
| **Tareas** | Todo lo accionable | Tarea · Estado (Bandeja/Siguiente/En curso/Esperando/Hecha) · Planificada · Fecha límite · Importante · Minutos · Área · Trabajo foto · Asignatura · Proyecto · Esperando a |
| **Trabajos foto** | Partidos y sesiones: el flujo completo | Nombre · Tipo (Partido/Sesión) · Fase (Solicitud→…→Archivo) · Fecha · Lugar · Competición · Equipos · Cliente · Galería (URL) · Entrega límite · Precio · Pago · Evento (URL) · Nota (URL a Obsidian) |
| **Publicaciones** | Calendario editorial de Instagram | Título · Estado (Idea/Selección/Edición/Lista/Publicada) · Fecha · Trabajo foto · Copy · Menciones · Resultados |
| **Contactos** | Clientes, clubes, medios, colaboradores | Nombre · Rol · Contacto · Trabajos foto |
| **Asignaturas** | Una ficha por asignatura | Nombre · Curso/Cuatrimestre · Profesor · Progreso del temario · Apuntes (URL a Obsidian) |
| **Evaluaciones** | Exámenes, trabajos y prácticas | Nombre · Tipo · Asignatura · Fecha límite · Estado · Nota · Peso |
| **Proyectos** | Proyectos personales o de varias tareas | Nombre · Estado · Área · Objetivo · Fecha objetivo |

**Descartado a propósito** (no compensa mantenerlo):
- Base de **material fotográfico** con inventario: la reemplaza una lista de equipo dentro de la plantilla de partido o sesión.
- **Hábitos** con checkboxes diarios: generan culpa y se abandonan. Las rutinas útiles van como tareas recurrentes.
- Una plantilla distinta para cada tipo de sesión: una plantilla de sesión con briefing y lista de tomas cubre todas.
- Registro de **métricas de Instagram** a mano: solo un campo "Resultados" opcional.

## Flujo fotográfico

`Solicitud → Planificación → Sesión/Partido → Selección → Edición → Entrega → Publicación → Archivo`

Es **una sola propiedad Fase** en *Trabajos foto*, con vista de tablero. La exportación usa **Comprimo**: preajuste *Entrega al cliente* para entregas y *Redes sociales* para Instagram.

## Universidad: estados de aprendizaje

En Obsidian, cada apunte o concepto tiene `estado`: **pendiente → estudiando → comprendido → repasar**. Un repaso espaciado ligero, opcional y sin plugins: `proximo_repaso` + `intervalo` (1, 3, 7, 14, 30 días). Una vista de Bases muestra "Repasar hoy". Si no lo usas, no estorba.

## Obsidian

Carpeta autocontenida `Sistema/` dentro de tu bóveda, sin tocar tu configuración. Solo usa plugins **del núcleo**:
- **Bases**: vistas tipo base de datos.
- **Plantillas**: plantillas de notas.

Nada de plugins de comunidad.

## Automatizaciones: criterio

Solo se activan si son **nativas, gratuitas y comprobadas**. Botones y plantillas de base de datos de Notion (crear un partido con sus tareas), plantillas de Obsidian, el preajuste de Comprimo. Nada que necesite claves API, Zapier/Make de pago ni servidores.
