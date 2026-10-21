# Contexto para continuar la conversación

> **Para Claude, al empezar una sesión nueva:** lee este archivo entero antes de hacer nada. Resume lo trabajado con el usuario (GitHub: **Reenillaa**) en una sesión anterior de Claude Code. Última actualización: 2026-10-21.

## Cómo trabajar con el usuario
- Escribe en **español**, en tono **cercano, juvenil y con humor**, como un amigo de toda la vida por WhatsApp ("valeee", "crack"…), con un ligero tonito de pique cariñoso. Le gustan los **ejemplos cotidianos** al explicar.
- Quiere **honestidad total**: nada de resultados inventados ni de falsa sensación de éxito. Distingue siempre entre COMPLETADO, PROBADO, CONFIGURADO PERO NO PROBADO y PENDIENTE.
- Usa un **Mac** (no Windows). Es **fotógrafo deportivo** (partidos, sesiones, Instagram) y **universitario**.
- No inventes datos personales: asignaturas, fechas, clientes, nombre…

---

## Proyecto 1: Comprimo (TERMINADO y publicado)

Compresor y conversor de imágenes gratuito y local, inspirado en TinyJPG, con app de escritorio para Mac pensada para fotógrafos.

- **Repo:** https://github.com/Reenillaa/comprimo (público; la app de Claude en GitHub tiene acceso de escritura).
- **Release v1.0.0:** https://github.com/Reenillaa/comprimo/releases/tag/v1.0.0, con los zips para Mac arm64 y x64 compilados en un runner macOS de GitHub. Firma ad-hoc verificada con `codesign`, sin notarizar.
- **Stack:**
  - Vite + React 19 + TypeScript.
  - Códecs WASM de jSquash: MozJPEG, libwebp, libavif, libjxl, OxiPNG y redimensionado.
  - Cuantizador PNG propio (`src/engine/quantize.ts`), porque libimagequant es GPL.
  - Web Workers.
  - Electron 44 para el escritorio (`electron/main.cjs`, `preload.cjs`).
- **Funciones clave:**
  - Calidad automática por imagen, con SSIM multiescala.
  - Preajustes para fotógrafos (web, redes, cliente, pruebas, máximo ahorro).
  - **Modo sesión**: vigila la carpeta de la cámara o del tethering.
  - Guardado automático en carpeta sin sobrescribir.
  - Comparador, ZIP, EXIF sin GPS, interfaz oscura con efectos.
- **Pruebas:** 110 unitarias/integración (`npm test`) · 17 E2E web (`npm run test:e2e`) · 5 E2E Electron (`xvfb-run -a npm run test:electron`) · CI completo en macOS (`.github/workflows/mac.yml`).
- **Releases:** el workflow publica la release automáticamente cuando `package.json` trae una **versión nueva** y se sube a `main`. Para la 1.0.1: sube la versión y haz push.
- **Docs:** `README.md`, `docs/` (investigación con REA, matriz de funciones, arquitectura, pruebas, benchmark).
- **Pendiente o mejorable:**
  - Notarizar con Apple Developer (99 $/año).
  - Fotos con mucho ruido (comprime poco).
  - PNG con degradados de alfa (sale sin pérdida).
  - Comparación con TinyJPG sin medir: su web estaba bloqueada en la red del entorno.

### Trampas del entorno cloud (para no repetirlas)
- La red bloquea `tinyjpg.com` y `tinypng.com`, y también el almacenamiento de artefactos y logs de GitHub (`*.blob.core.windows.net`). Los fallos de CI se leen con `gh api repos/Reenillaa/comprimo/check-runs/<job_id>/annotations`, gracias al reporter `github` de Playwright.
- **No se pueden** subir etiquetas por git ni crear tags o releases por la API de escritura desde la sesión. Las releases las crea el propio workflow.
- La descarga de Electron por npm se corta: hay que bajar los zips con `curl` desde `github.com/electron/electron/releases` y extraerlos en `node_modules/electron/dist` (más `path.txt`).
- Para firmar ad-hoc desde Linux: `rcodesign` 0.29 (releases de `indygreg/apple-platform-rs`).
- `pkill -f "vite preview"` mata la propia shell: usa `pkill -f "[v]ite preview"`.

---

## Proyecto 2: Sistema operativo personal (EN CURSO, bloqueado por Notion)

El usuario pidió un ecosistema **Notion + Obsidian + Google Calendar** para fotografía (partidos, sesiones, Instagram, clientes), universidad, tareas y calendario. Todo está en `contexto/sistema-personal/`.

| Parte | Estado | Dónde |
|---|---|---|
| Arquitectura y fuentes de verdad | COMPLETADO | `sistema-personal/docs/arquitectura.md` |
| Carpeta de Obsidian `Sistema` (Inicio, Universidad, Fotografía, 6 plantillas, 3 Bases) | **PROBADO** en Obsidian 1.12.4 real (bajo Xvfb, con bóveda de prueba) | `sistema-personal/Sistema/` |
| Guía de inicio | COMPLETADO | `sistema-personal/EMPIEZA-AQUI.md` |
| **Plano de Notion**: 7 bases relacionadas, vistas, plantillas de partido y sesión, dashboard en 3 columnas | Diseñado, **PENDIENTE de construir** | `sistema-personal/docs/notion-blueprint.md` |
| Estrategia de calendario | Diseñada, **PENDIENTE** | `sistema-personal/docs/calendario.md` |
| Informe de entrega (Claude Doc) | COMPLETADO | https://claude.ai/artifact/1BwkpMfZGbj8xRMokfQT5Z |

**Decisiones tomadas:**
- Google Calendar es la fuente de verdad de lo que tiene hora fija.
- Notion lleva las tareas, los trabajos de foto, las publicaciones y las evaluaciones.
- Obsidian guarda apuntes y conocimiento, con solo plugins del núcleo (Bases y Plantillas).
- Sin sincronización bidireccional: para verlo todo junto se usa **Notion Calendar**.
- Las tareas tienen **Fecha límite** (real) y **Planificada** (elegida por él).
- Un solo flujo fotográfico con la propiedad *Fase*: Solicitud → Planificación → Hecho el shooting → Selección → Edición → Entrega → Publicado → Archivado.
- Descartado: inventario de material, hábitos, métricas manuales de Instagram, Zapier y Make.

**Bloqueo:** los conectores de **Notion y Google Calendar** están conectados a su cuenta, pero no estaban **habilitados en la sesión** (`enabledInChat: false`). Se le indicó activarlos en https://claude.ai/customize/connectors (permisos de herramientas → Permitido) o abrir una sesión nueva con ellos activos.

### Siguiente paso (en la sesión nueva)
1. Comprueba con `ListConnectors` o con `ToolSearch` buscando "notion" que las herramientas de Notion y Calendar estén disponibles. Si no, díselo en dos líneas y no inventes nada.
2. **Construye en Notion el plano** de `docs/notion-blueprint.md`:
   - La página 🧭 Centro.
   - Las 7 bases con sus relaciones duales, las vistas y las plantillas de partido y sesión (con sus tareas vinculadas).
   - Los botones de captura y la revisión semanal.
   - **Prueba** con una ficha "ZZ prueba" y bórrala al terminar.
   - No crees datos personales inventados.
3. **Calendar:** solo lectura salvo autorización explícita. Nada de invitaciones a terceros ni de modificar eventos existentes.
4. Actualiza el informe de entrega (Claude Doc de arriba) con los estados nuevos.
5. Pendiente de respuesta del usuario: ¿Notion como centro o todo en Obsidian? Hay un comentario abierto en el informe. Si no contesta, sigue con Notion, que es lo que pidió.

### Cómo se probó Obsidian (reproducible)
1. Descarga `Obsidian-1.12.4.AppImage` desde `github.com/obsidianmd/obsidian-releases/releases` y extráelo con `--appimage-extract`.
2. Configura `~/.config/obsidian/obsidian.json` apuntando a una bóveda de prueba con `core-plugins.json` que incluya `bases` y `templates`.
3. Lánzalo: `xvfb-run -a ./obsidian --no-sandbox --remote-debugging-port=9223`.
4. Conecta Playwright con `connectOverCDP` y usa `app.workspace` / `app.internalPlugins` para abrir notas e insertar plantillas.
