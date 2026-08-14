# Mi Santuario × GOD NODE 2026 — Mapa de Integración

Documento puente entre el GOD_NODE_2026_ACTUALIZADO.md (sistema de vida completo)
y la app Mi Santuario (Cloudflare Worker). Define qué módulos existen, cuáles
se expanden y cuáles se crean desde cero.

---

## 1. Módulos EXISTENTES en Mi Santuario (expandir, no recrear)

| Módulo actual | Qué le falta del GOD_NODE |
|---|---|
| **Hábitos** | Agua 3L (no solo 8 vasos), Movimiento 30min, Sueño 7.5h con tracker de consistencia horaria |
| **Mente → Diario** | Estructura Apertura (3 prioridades + pregunta del día) / Cierre (victorias, fricciones, revisión emocional) |
| **Mente → Decisiones** | Plantilla Premortem completa (opciones A/B, causas de fracaso, protecciones, punto de revisión) |
| **Academia IA** | Currículo 90 días estructurado en 3 bloques (semanas 1-3, 4-6, 7-9) con tabla tema/horas/entregable/checkpoint. Código de colores 🔴🟡🟢 por tema |
| **Finanzas** | Metas de ahorro (corto/medio/largo), reglas de dinero fijas, presupuesto con 3 fuentes de ingreso (Vida Fácil archivado → reemplazar por RAI/MediGo/Content Engine) |
| **Arquitecto Digital → Clientes** | Kanban TO-DO/DOING/DONE con regla "máximo 2 DOING", matriz Impacto vs Esfuerzo por proyecto |
| **Japón** | Ya cubre fondo — sin cambios estructurales |

---

## 2. Módulos NUEVOS a crear

### 2.1 Sistema Maestro (Fricciones + Territorios)
- **Vómito Mental**: lista de fricciones detectadas (input libre, timestamp)
- **3 Territorios**: máx 3 áreas activas con objetivo 6 meses + KPI (hoy: RAI Agency, Content Engine, Dominio Técnico IA)
- **El Único Avión**: 1 proyecto crítico activo, con deadline y bloqueantes — resto en backlog explícito

### 2.2 Bloques de Foco (Ciclos Ultradianos)
- Timer 90-120 min con registro de bloques completados/rotos
- Tracker semanal: bloques logrados, duración promedio, causa de rupturas
- Vinculado a Aislamiento de Dominios (1 proyecto por bloque/día)

### 2.3 Creatividad
- Tracker piezas iniciadas / finalizadas / publicadas (por tipo: tweet, artículo, código, diseño)
- % finalización (meta >70%)
- Banco de analogías (transferencia entre dominios)

### 2.4 Journaling Cornell/Zettelkasten
- Nota tipo Cornell (proyecto/cliente): preguntas | notas | síntesis
- Nota tipo Zettelkasten (estudio): ID, referencia, contenido, conexiones, reflexión
- Flujo viernes: scanning → extracción → síntesis → proyección

### 2.5 Dieta de Input
- Contador diario Twitter/YouTube/Discord con límite (15/120min-mes/20min)
- Alerta si excede límite semanal
- Lista negra visible (TikTok, Reddit, noticias tiempo real — prohibido, sin tracker, solo recordatorio)

### 2.6 Hardware Biológico
- Sueño: horas + consistencia de horario (no solo promedio)
- Batch cooking: checklist domingo
- Vinculado a Hábitos existente (no duplicar Agua)

### 2.7 Post-Mortem Semanal (3 preguntas)
- ¿Qué bloque tuvo máximo ROI?
- ¿Dónde se rompió la concentración?
- ¿Qué proceso repetido 3+ veces debo automatizar?
- Acción concreta por cada respuesta

### 2.8 Polimatía / Disciplina Trimestral
- 1 disciplina activa por trimestre (libros, aplicación, output esperado)
- Tracker de lectura interdisciplinaria (2h/semana fuera del campo)

### 2.9 Plantillas Operacionales (biblioteca)
- Revisión diaria (5 min)
- Cierre del día (10 min)
- Revisión semanal (45 min, viernes)
- Planificación mensual (1h)
- Decisión importante / Premortem (ya cubierto en 1, reusar componente)

---

## 3. Prioridad de construcción (orden sugerido)

```
FASE 1 (Semana 1): Fundacional
  → Sistema Maestro (Fricciones + Territorios + Único Avión)
  → Plantillas Operacionales (Revisión diaria + Cierre día)
  → Expandir Diario (Mente) con estructura Apertura/Cierre

FASE 2 (Semana 2): Ejecución
  → Bloques de Foco (timer + tracker)
  → Post-Mortem Semanal
  → Expandir Academia IA con currículo 90 días + código colores

FASE 3 (Semana 3): Refuerzo
  → Creatividad (tracker)
  → Dieta de Input (contador límites)
  → Journaling Cornell/Zettelkasten

FASE 4 (Semana 4): Pulido
  → Hardware Biológico (batch cooking, sueño consistencia)
  → Polimatía (disciplina trimestral)
  → Expandir Finanzas (metas ahorro + reglas dinero)
```

---

## 4. Notas de implementación

- Todo sigue el patrón actual: vanilla JS, `state` object → localStorage, funciones `render*()` + `save()`.
- Sin backend nuevo. Sin KV. Todo dentro de `index.html`.
- Nuevos módulos = nuevas `<section class="sec">` + entrada en drawer + funciones JS correspondientes, mismo patrón que Academia/Japón.
- Contexto de negocio actualizado en `state`: reemplazar "Vida Fácil" por fuentes activas (RAI Agency, MediGo, Content Engine) en Finanzas y Proyectos.
