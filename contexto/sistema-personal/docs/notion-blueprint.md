# Notion: plano de construcción

Estado: **PENDIENTE**. El conector de Notion está conectado a tu cuenta, pero desactivado en el chat donde se construyó el sistema. Este plano permite construirlo en cuanto se active, o hacerlo a mano.

Estilo: iconos de Notion en un solo color, portadas sobrias (gradientes oscuros o tus propias fotos deportivas), nombres de una o dos palabras y emojis solo en los títulos de sección del dashboard.

## Estructura de páginas

```
🧭 Centro                      ← dashboard (única página en la barra lateral)
   ├─ 📥 Bandeja               ← vista de Tareas con Estado = Bandeja (y de Ideas sin clasificar)
   ├─ 📷 Fotografía            ← tablero de trabajos, publicaciones, contactos
   ├─ 🎓 Universidad           ← asignaturas, evaluaciones
   ├─ ✅ Tareas                ← vistas Hoy, Siguiente, Programadas, Esperando
   ├─ 🔁 Revisión semanal      ← plantilla repetible (una página por semana)
   └─ ⚙️ Bases                 ← las 7 bases de datos (aquí viven; el resto son vistas enlazadas)
```

## Bases de datos

### ✅ Tareas
| Propiedad | Tipo | Opciones o fórmula |
|---|---|---|
| Tarea | Título | |
| Estado | Estado | Por hacer: **Bandeja**, **Siguiente** · En curso: **En curso**, **Esperando** · Hecho: **Hecha** |
| Planificada | Fecha | Día que eliges hacerla |
| Fecha límite | Fecha | Solo si es real |
| Importante | Casilla | |
| Minutos | Número | Estimación (15, 30, 60, 120) |
| Área | Selección | Fotografía · Universidad · Personal |
| Trabajo foto | Relación → Trabajos foto | dual: Tareas |
| Asignatura | Relación → Asignaturas | dual: Tareas |
| Proyecto | Relación → Proyectos | dual: Tareas |
| Esperando a | Texto | Persona o cosa |
| Atrasada | Fórmula | `prop("Fecha límite") < today() and prop("Estado") != "Hecha"` |
| Semana | Fórmula | `formatDate(prop("Planificada"), "YYYY-[S]WW")` |

**Vistas**:
- **Hoy**: Planificada ≤ hoy o Fecha límite ≤ hoy+2, y no Hecha. Orden: Importante, Fecha límite. Muestra los Minutos sumados.
- **Siguiente**: Estado = Siguiente y sin Planificada.
- **Programadas**: calendario por Planificada.
- **Esperando**.
- **Bandeja**.
- **Carga semanal**: tabla agrupada por Semana, con la suma de Minutos.

### 📷 Trabajos foto
| Propiedad | Tipo | Opciones |
|---|---|---|
| Nombre | Título | `Local vs Visitante · Competición` / `Sesión · Cliente` |
| Tipo | Selección | Partido · Sesión |
| Fase | Estado | Por hacer: **Solicitud**, **Planificación** · En curso: **Hecho el shooting**, **Selección**, **Edición**, **Entrega** · Hecho: **Publicado**, **Archivado** |
| Fecha | Fecha (con hora) | Día del partido o sesión |
| Lugar | Texto | |
| Competición | Selección | (se crean al usarlas) |
| Equipos | Texto | |
| Cliente | Relación → Contactos | |
| Entrega límite | Fecha | |
| Galería | URL | Carpeta o galería donde están las fotos |
| Precio | Número (€) | Solo sesiones de pago |
| Pago | Selección | No aplica · Pendiente · Señal · Pagado |
| Evento | URL | Evento de Google Calendar |
| Nota | URL | Aprendizajes en Obsidian (`obsidian://…`) |
| Publicaciones | Relación → Publicaciones | dual |
| Tareas | Relación → Tareas | dual |

**Vistas**:
- **Flujo**: tablero por Fase.
- **Próximos**: Fecha ≥ hoy, ordenados.
- **Por entregar**: Fase en Selección, Edición o Entrega, ordenados por Entrega límite.
- **Cobros**: Pago = Pendiente o Señal.
- **Archivo**.

**Plantillas** (botón "Nuevo"):
1. **Partido**. Checklist: ☐ acreditación o permiso · ☐ baterías y tarjetas · ☐ objetivo tele y angular · ☐ revisar horario y luz. Secciones: *Ideas de fotos* · *Selección (enlace a la carpeta)* · *Créditos y menciones* · *Contenido posterior*. Crea automáticamente 3 tareas vinculadas: "Selección", "Edición y exportación (Comprimo → Redes sociales)" y "Entrega o publicación".
2. **Sesión**. Briefing (objetivo, estilo, referencias) · Lista de tomas · Equipo · Localización y plan B · Entrega (formato y plazo) · Pago. Tareas creadas: "Preparar sesión", "Selección", "Edición" y "Entrega (Comprimo → Entrega al cliente)".

### 📣 Publicaciones
| Propiedad | Tipo | Opciones |
|---|---|---|
| Título | Título | |
| Estado | Estado | Idea · Selección · Edición · Lista · Publicada |
| Fecha | Fecha | Prevista o real |
| Formato | Selección | Post · Carrusel · Reel · Historia |
| Trabajo foto | Relación → Trabajos foto | |
| Copy | Texto | |
| Menciones | Texto | @equipo, @jugador, créditos |
| Resultados | Texto | Opcional, solo si lo apuntas |

**Vistas**: **Calendario editorial** (calendario por Fecha) y **Tablero** (por Estado).

### 👥 Contactos
Nombre · Rol (Cliente, Club, Medio, Colaborador) · Contacto (texto: solo lo imprescindible) · Trabajos foto (relación).

### 🎓 Asignaturas
Nombre · Curso (selección) · Cuatrimestre (selección) · Profesor (texto) · Temas totales (número) · Temas vistos (número) · Progreso (fórmula `prop("Temas vistos") / prop("Temas totales")`, como barra) · Apuntes (URL `obsidian://open?vault=…&file=Sistema/Universidad/…`) · Evaluaciones (relación) · Tareas (relación).

### 📝 Evaluaciones
Nombre · Tipo (Examen, Trabajo, Práctica, Entrega) · Asignatura (relación) · Fecha límite (fecha) · Estado (Pendiente, En curso, Entregada, Calificada) · Nota (número) · Peso % (número) · Evento (URL).

**Vistas**: **Próximas** (Fecha límite ≥ hoy, ordenadas) y **Calendario**.

### 🎯 Proyectos
Nombre · Estado (Idea, Activo, En pausa, Hecho) · Área · Objetivo (texto) · Fecha objetivo · Tareas (relación).

## 🧭 Centro (dashboard)

Diseño en **3 columnas** en escritorio. Arriba:
- Portada.
- Saludo ("Buenos días" + tu nombre si quieres) con un bloque de fecha `@Hoy`.
- **Botones**: ➕ Tarea · 📷 Partido · 📸 Sesión · 💡 Idea. Son botones nativos de Notion que crean la página con la plantilla.

| Columna 1 · Hoy | Columna 2 · Fotografía | Columna 3 · Universidad |
|---|---|---|
| Vista **Hoy** de Tareas (máx. 7) | **Próximos** partidos y sesiones (5) | **Próximas** evaluaciones (5) |
| **Atrasadas** (solo si hay) | **Por entregar** | Asignaturas con barra de progreso |
| **Esperando** | **Publicaciones**: Lista o Edición | |

Abajo: **Carga semanal** (minutos planificados por semana; más de unas 15 h de tareas en una semana con partidos es aviso de saturación) y un enlace a 🔁 **Revisión semanal**.

**Revisión semanal** (plantilla, 15 min):
1. Vaciar la Bandeja.
2. Revisar Atrasadas y Esperando.
3. Mirar el calendario de las 2 próximas semanas.
4. Elegir 3 prioridades.
5. Repasos pendientes en Obsidian.
6. ¿Algún trabajo atascado en Edición?

## Automatizaciones nativas (gratis)

- **Botones** de Notion: crear desde plantilla.
- **Plantillas de base de datos** con tareas vinculadas.
- **Notion Calendar**: muestra Tareas (Planificada), Trabajos foto y Evaluaciones junto a Google Calendar, sin sincronizar nada.
- **Recurrencia de plantillas**: Revisión semanal cada domingo.
- **Descartado**: Zapier o Make (de pago o con límites) y sincronización bidireccional con Calendar (duplicados).
