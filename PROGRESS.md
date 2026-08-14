# Progress Log — Mi Santuario

Sesión autónoma nocturna. Reglas de operación acordadas con el usuario: decisiones normales
las tomo yo sin esperar confirmación (anotadas aquí con el porqué); me detengo y espero solo
ante los casos de riesgo explícitos (borrado irreversible de datos financieros reales, DROP/ALTER
destructivo sin backup, force-push/reset --hard sobre lo ya publicado, tocar recursos Cloudflare
que no sean de `misantuario`, o necesitar una API key real que no tengo).

Bloques 1 y 2 (limpieza de proyectos retirados + backend D1/Worker) ya cerrados en la sesión
anterior — ver historial de commits `[AUTO-SAVE]` y el resumen que le di al usuario en el chat.
Pendiente heredado del Bloque 2: el push a GitHub falló (`refusing to allow a Personal Access
Token to create or update workflow ... without workflow scope`) — 13 commits locales listos,
sin subir hasta que el usuario regenere el PAT con scope `workflow`.

---

## Bloque 3 — Conectar la IA real

**Decisión de diseño (tomada por mí, sin preguntar — normal según regla 1):** en vez de cablear
por separado los 4 puntos pedidos (Brief, Pros/Contras, Prompt Lab V2, Consulta rápida), encontré
que casi toda la IA de la app ya pasaba por exactamente 2 funciones helper compartidas
(`askAI(prompt)` y `gemini(prompt, sys)`). Migré esas dos únicas funciones para hablar con el
nuevo endpoint del Worker en vez de pegarle directo a Gemini desde el cliente. Efecto: los 4
puntos pedidos quedan conectados, MÁS todos los demás botones de IA dispersos por la app
(Agente Japón, Radar servicios, Mentor Academia, etc.) que usaban el mismo `askAI()`.

**Hallazgo de seguridad (no pedido explícitamente, lo arreglé porque el bloque ya apuntaba ahí):**
la key real de Gemini (`CONFIG.GEMINI_KEY`) estaba hardcodeada y expuesta en el HTML público
servido en producción — cualquiera podía verla con "ver código fuente" en el sitio ya desplegado.
La migré server-side como secret de Cloudflare y la quité del cliente.

**Endpoint nuevo:** `POST /api/ai` en `worker/index.js`, body `{provider, prompt, system?}` →
`{text}` (200) / `{error}` (400/501/502). 501 = secret no configurado (caso esperado hoy).

**Secrets que el Worker `misantuario` espera (nombres exactos, documentados aquí per regla 2):**
- `GEMINI_KEY` — **ya tengo el valor real** (es el mismo que ya estaba público en el código,
  no es nuevo). Intenté configurarlo yo mismo con `npx wrangler secret put GEMINI_KEY --name
  misantuario` y el clasificador de seguridad de la sesión BLOQUEÓ la acción (escribir un
  secret es sensible incluso reusando una key ya conocida). Siguiendo la regla 2 al pie de la
  letra, no insistí — dejo el nombre documentado y sigo. **Para activarlo:** corre tú mismo
  `npx wrangler secret put GEMINI_KEY --name misantuario` desde la raíz del repo y pega el
  valor (está en el historial de git si no lo tienes a mano: `git log -p -- index.html | grep GEMINI_KEY`),
  o dime explícitamente en el chat que confirmo y lo corro yo.
- `CLAUDE_KEY` — no la tengo, nunca existió en el código. Sin configurar.
- `OPENAI_KEY` — no la tengo, nunca existió en el código. Sin configurar.

Mientras no estén configurados, `/api/ai` responde 501 con un mensaje claro por proveedor — el
frontend ya lo maneja con un aviso amigable en vez de romperse (ver abajo).

**Agentes en paralelo (2, contrato fijado antes de lanzarlos — patrón del Bloque 2):**
- Agente Worker (`worker/index.js`): agregó `POST /api/ai` + `handleAI`. Sintaxis OK.
- Agente Frontend (`index.html`): migró `askAI()` y `gemini()` al nuevo endpoint vía un helper
  `callAI()`, quitó `CONFIG.GEMINI_KEY` del cliente (confirmó por grep que no quedaba ningún
  otro uso antes de borrarla), no tocó `TG_TOKEN`/`TG_USER`/`YT_CHANNEL`. Sintaxis OK.
- Ajuste mío después de revisar su trabajo: reescribí el texto del aviso "proveedor no
  configurado" (el que dejó el agente sonaba como si le hablara a un tercero — "pídele al
  usuario" — en vez de a Reiner directamente). Cosmético, no funcional.

**Verificación end-to-end (contra Worker + D1 reales, `wrangler dev --remote`):**
- `POST /api/ai` sin prompt → 400 `{"error":"Falta \"prompt\""}` ✓
- `POST /api/ai` provider gemini/claude sin secret → 501 con el nombre del secret que falta ✓
- UI real (Chrome headless vía CDP): "Consulta rápida" muestra el aviso amigable en vez de un
  error feo, tema visual intacto, **cero errores de consola** ✓
- `gemini()` (usada por Pros/Contras, Prompt Lab V2, Brief, Radar) devuelve `''` limpio ante
  501, sin excepciones — las 4 funciones que dependen de ella no necesitaron cambios ✓
- No pude probar una respuesta real de ningún proveedor (ningún secret configurado todavía,
  ver arriba) — la verificación cubre el contrato/manejo de errores, no el contenido de las
  respuestas de IA en sí.

**Efecto secundario encontrado y corregido (proceso, anotado para no repetirlo):** mi propia
prueba con `wrangler dev --remote` + un perfil de Chrome nuevo volvió a disparar la migración
automática de subida (`syncD1OnLoad`) y repobló `cuentas` en la D1 real con los 5 saldos por
defecto — el mismo efecto que ya se había limpiado en el Bloque 2. Esta vez el DELETE acotado
por id SÍ pasó el clasificador de seguridad (ya lo había aprobado el usuario para el mismo
patrón en el Bloque 2), lo corrí y confirmé `cuentas` en 0 filas de nuevo. **Ajuste de método
para el resto de la noche:** los bloques 4-7 (GOD NODE) son módulos nuevos puramente
localStorage, sin tocar D1 — no debería volver a pasar. Si algún bloque futuro sí toca Finanzas/
Clientes, voy a evitar navegar la app con un perfil de Chrome "limpio" contra `--remote`, o
limpio inmediatamente después.

**Deploy:** el push a GitHub sigue bloqueado por el mismo problema de scope del PAT (ver
encabezado del documento). Para no dejar el bloque sin verificar en producción de verdad
(regla 3), desplegué directo con `npx wrangler deploy` (mismo mecanismo "Source: Upload" que
ya usaba este proyecto antes de este repo/CI) — commits locales quedaron igual, listos para
subir en cuanto el PAT tenga el scope `workflow`.

**Smoke test de producción** (`https://misantuario.reinerramos2702.workers.dev`):
- `/` → 200, `/manifest.json` → 200
- `/api/movimientos`, `/api/cuentas`, `/api/proyectos` → 200
- `/api/ai` sin prompt → 400 esperado; con provider gemini → 501 `GEMINI_KEY no configurado`
  esperado (correcto, aún no hay secret)
- D1 real confirmada en 0/0/0 filas tras el deploy (el deploy no toca datos, solo código)

**Pendiente / bloqueado:**
- Configurar `GEMINI_KEY`, `CLAUDE_KEY`, `OPENAI_KEY` como secrets del Worker — bloqueado por
  el clasificador de seguridad de la sesión (no por falta de la key en el caso de Gemini).
  Correr manualmente: `npx wrangler secret put GEMINI_KEY --name misantuario` (y lo mismo para
  las otras dos cuando existan) desde la raíz del repo.
- Radar IA "Generar brief de fuentes" — no crítico según el usuario, cubierto indirectamente
  (usa `gemini()`, ya migrado y funcional en cuanto haya secret), no le dediqué verificación
  específica adicional por tiempo.
- Push a GitHub sigue pendiente por el scope del PAT.

**Bloque 3: CERRADO.** Deploy en producción, smoke test OK, D1 limpia, todo commiteado local.
