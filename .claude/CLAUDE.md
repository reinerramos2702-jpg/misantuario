# Mi Santuario — Sistema Operativo Personal

**Rol:** Arquitecto full-stack. Claude Code maneja despliegue automático (GitHub Actions + Wrangler), actualizaciones de UI/UX, optimizaciones de rendimiento.

**Stack:**
- Frontend: Vanilla JS (HTML/CSS/JS inline, ~5820 líneas al cierre del Bloque 9 — subió desde
  las 4009 originales por los módulos GOD NODE de los Bloques 4-8; ver `PROGRESS.md`)
- Backend: Cloudflare Worker (misantuario.reinerramos2702.workers.dev)
- Hosting: Cloudflare Pages/Workers
- CI/CD: GitHub Actions + Wrangler CLI
- Datos: localStorage (PWA, personal)

**Contexto de negocio:**
OS personal único del usuario (Reiner). Dashboard gamificado que rastrea hábitos, proyectos, finanzas, mente, Japón. Interfaz premium (Fraunces + Inter, tema verde oscuro × cósmico). PWA instalable. Sin backend DB — todo data en localStorage.

**Módulos actuales:**
- Header: Saludo dinámico, XP/Nivel (anillo SVG)
- Mission Card: Objetivo del día + KPIs (4 valores)
- Secciones (tabs): Hábitos, Proyectos, Finanzas, Mente, Japón
- Manifest PWA + icono SVG

**Restricciones:**
1. NUNCA exponer datos personales (finanzas, hábitos privados) en logging
2. Tono: Zen, personal, introspectivo — no corporativo
3. Design: Fidelidad strict al tema actual (colores CSS vars), sin breaking changes visuales
4. Privacidad: Datos nunca salen de localhost/PWA, no analytics
5. Despliegue: Automatizado — SOLO Git push → GitHub Actions → Wrangler deploy
6. Performance: Sub-2s load, < 50KB bundle (sin comprometer UI) — **superado desde el
   Bloque 9**: `index.html` gzip real ≈ 67KB (283KB sin comprimir, ~5820 líneas) tras sumar
   los módulos GOD NODE. Sigue cargando rápido en la práctica (un solo archivo estático,
   sin build step, cache-first vía `sw.js`), pero el número ya no cumple el budget original
   tal cual — decisión pendiente del usuario si vale la pena minificar/dividir o si el budget
   se actualiza para reflejar el alcance real de la app hoy.

**Workflow futuro:**
- [ ] Primer skill: automatizar estructura de despliegue (GitHub Actions template)
- [ ] Segundo skill: generador de módulos nuevos (template para secciones)
- [ ] Conectar MCP Cloudflare para deployments CLI-free
