# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Astro (proyecto existente, `astro@^7`, Node >= 22.12). El stack ya está definido por el código; no fue una decisión abierta.

## Users

Usuario principal: **personal administrativo de TI** de **UNIFRANZ** (Universidad Privada Franz Tamayo), sede Santa Cruz. Su tarea es analizar el flujo de ingreso de estudiantes a partir de las marcaciones de los dispositivos ZKTeco (molinetes): cuántos entran, a qué horas, por qué carrera, y quiénes están bloqueados por deuda.

## Product Purpose

Convertir las exportaciones crudas de control de acceso (CSV/Excel) de los equipos ZKTeco en un **informe de una sola página** legible que responda, de un vistazo, a las preguntas operativas de asistencia estudiantil: volumen de ingresos, horarios/picos de entrada, distribución por carrera y estudiantes bloqueados por deuda. El éxito es que el personal de TI entienda el flujo del día (o período) sin manipular hojas de cálculo.

## Positioning

No es el software genérico de ZKTeco ni una planilla de Excel: toma la exportación real del dispositivo y la traduce a un resumen institucional orientado al caso concreto de esta institución — flujo estudiantil cruzado con **carrera** y **estado de deuda/bloqueo**, una lectura que las herramientas de fábrica no entregan tal cual.

## Operating Context

- Los dispositivos ZKTeco (molinetes en puertas, identificados por IP, p. ej. `192.168.5.111`) controlan el ingreso físico; un estudiante **bloqueado por deuda** no puede pasar. El estado de bloqueo vive en la base de estudiantes (`Deuda Molinete`), no en el log del molinete.
- El personal de TI **exporta manualmente** los archivos y los usa como fuente. No hay conexión en vivo a API/SDK ni base de datos intermedia (a la fecha).
- El consumo es de **revisión/análisis**: leer el resumen, no editar registros.
- El log de molinetes registra **solo eventos de "Entrada"** y de **Salida**, e incluye no solo estudiantes sino también `VISITA`, `DOCENTE` y `ADMINISTRATIVOS` los cuales estos ultimos 3 se deben de excluir para el resumen final, solo se debe de tomar en cuenta a los Estudiantes, que son todos aquellos que tienen en nombre del departamento lo siguiente: ADM, AHT, ARQ, BYF, CPU, DER, DGP, ENF, GAC, ICO, MED, ODO, PER, PSI, PYM, SIS.
- Existe 4 molinetes identificados con 4 tipos de direcciones diferentes las cuales son: 192.168.5.106, 192.168.5.110, 192.168.5.111, 192.168.5.112. Cada una de ella luego tiene una denominacion de un -1, -2, -3, o hasta -4, luego todos tiene Entrada o Salida, exepto uno, que es la 192.168.5.106, en esta la que dice 192.168.5.106-1 se la considera Entrada, y 192.168.5.106-2 se la considera Salida.

## Capabilities and Constraints

Tres archivos reales en `archives/` (verificados):

1. **`Registro molinetes.xls`** — hoja `Todos los Eventos`, 100 000 eventos (rango 2026-04-07 → 2026-04-24), 2 992 personas distintas. Cabecera en la fila 2. Columnas: `Tiempo`, `Nombre de Área` (siempre "Entrada" — **NO indica dirección, ignorar**), `Nombre de Dispositivo` (IP), `Punto del Evento`, `Descripción del Evento` (`Apertura con verificación normal` 77 %, `Usuario no registrado` 15 %, `Deshabilitada` 7 %, y eventos de sistema), `Nivel de Evento`, `ID` (id interno del dispositivo, **numérico**), `Nombre`, `Apellido`, `Tarjeta`, `Nombre de Departamento` (código de carrera + VISITA/DOCENTE/ADMINISTRATIVOS), `Nombre de Lector` (**mal etiquetado, ignorar para dirección**), `Modo de Verificación` (Huella/Tarjeta).

   - **Dirección (Entrada/Salida):** se deriva del texto de **`Punto del Evento`**. Si contiene "Entrada"/"Salida" (sin distinguir mayúsculas), esa es la dirección. Excepción `192.168.5.106` (sin la palabra): `106-1` = Entrada, `106-2` = Salida. Ojo: `192.168.5.112` tiene la numeración invertida respecto a los otros molinetes, pero su `Punto del Evento` trae la palabra explícita, así que se respeta el texto. Resultado verificado: **49 215 entradas / 50 375 salidas** (410 eventos de sistema sin dirección se descartan).
   - **Filtro de estudiantes:** para el resumen se cuentan **solo estudiantes**, es decir filas cuyo `Nombre de Departamento` esté en `{ADM, AHT, ARQ, BYF, CPU, DER, DGP, ENF, GAC, ICO, MED, ODO, PER, PSI, PYM, SIS}` (16 carreras). Se **excluyen** `VISITA`, `DOCENTE`, `ADMINISTRATIVOS` y vacíos. Verificado: estudiantes = **33 964 entradas / 35 611 salidas**.
2. **`BD Estudiantes General.xlsx`** — hoja `Base de Datos`, **2 690 estudiantes activos** (`Gestión`: 2 526 Antiguo + 164 Nuevo), 62 columnas, cabecera en la fila 1. Relevantes para el informe: `Carrera` (18 códigos, incluye DDP/THO que no aparecen en molinetes), `Código` (académico, p. ej. `ADM14512233`), apellidos y nombres, `Semestre`, `Gestión`. Se usa para el **total de estudiantes activos** (denominador de la tasa de asistencia). Otras columnas (montos, `Deuda Molinete`, `% Beca`) no se usan en el alcance actual.
3. **`Nuevos inscritos.xlsx`** — hoja `NUEVOS`, **164 filas útiles**, cabecera en la fila 3 (títulos "ADMISIONES 2.2026 / SEDE SANTA CRUZ" en las filas 1-2). Datos de admisión: carrera, código, `MES` de inscripción, datos personales, canal, asesor, etc. Aporta el conteo de nuevos inscritos por carrera y por mes.

- **Interacción principal:** la página permite **cargar un archivo CSV/Excel de registros de molinetes** desde el navegador; todas las métricas se **recalculan en el cliente** a partir de ese archivo (parseo en el navegador, sin backend).
- **Período dinámico:** el rango visualizado **no es fijo**; se deriva del `Tiempo` mínimo y máximo del archivo cargado y se muestra explícitamente ("desde … hasta …"). Todo el resumen depende de las fechas que contenga el archivo.
- **Salida:** una página única de resumen (no app multi-vista; no PDF como requisito, aunque una página web es imprimible).
- **Tres archivos cargables, con roles distintos:**
  - `Registro molinetes` = fuente **primaria**, la que se sube **constantemente** para actualizar el flujo (entradas/salidas/afluencia/denegaciones).
  - `BD Estudiantes General` = **total de estudiantes activos** (2 690: 2 526 antiguos + 164 nuevos). Se actualiza ~cada 6 meses. Aporta el **denominador** para la tasa de asistencia (entrantes únicos ÷ total activos).
  - `Nuevos inscritos` = **nuevos inscritos por gestión** (164), con desglose por carrera y por mes. Aporta la métrica de admisiones.
  - Cada archivo tiene su propia zona de carga; el informe conserva el último cargado de cada tipo y recalcula.
- **Regla de conteo diario (dedup):** un estudiante puede entrar y salir varias veces el mismo día; para los totales **cuenta como 1 entrada y 1 salida por día** (deduplicado por `ID` + día + dirección). Los intentos denegados ("Deshabilitada") **no** cuentan como ingreso efectivo. Verificado en la app: **19 928 ingresos únicos** / 20 365 salidas únicas en 17 días; tasa de asistencia promedio ≈ 43,6 % (1 172 ÷ 2 690 activos).
- **Eventos crudos → afluencia horaria:** los múltiples pasajes por persona/hora **no** se descartan; se usan para estimar en qué franjas hay mayor afluencia de estudiantes dentro de la universidad (patrón por hora / aforo aproximado combinando entradas y salidas).
- **Bloqueados por deuda (resuelto):** son las filas con `Descripción del Evento` = **"Deshabilitada"** cuyo `Nombre de Departamento` es una carrera de estudiante. El conteo de personas se deduplica por `ID`. Verificado en la muestra: 7 344 eventos denegados = **848 estudiantes distintos**. (Ojo: la palabra vive en `Descripción del Evento`; `Nivel de Evento` es Normal/Excepción/Alarma.)
- **Listado de bloqueados (spec):** conteo por carrera + total, siempre visible. Además un **apartado colapsable (oculto por defecto)** con **nombre + CI** de cada estudiante bloqueado, **exportable** (descarga CSV/Excel). Sin nº de intentos denegados. El **CI** no está en molinetes ni en la columna `Carnet`; es la **parte numérica del `Código`** de la BD (7–8 dígitos; `ADM14512233` → `14512233`). Requiere cruzar molinetes→BD **por nombre+apellido**, cobertura verificada **~79 %** (673/848); el resto se muestra con nombre y CI vacío. Por tanto el CI del listado **depende de que la BD esté cargada**; sin BD, se listan nombres sin CI.
- **Métricas objetivo:** volumen total (entradas/salidas únicas del período) como dato protagonista; **tasa de asistencia** (entrantes únicos ÷ total de estudiantes activos de la BD, por día y del período); afluencia por hora; desglose por carrera; bloqueados por deuda (conteo + listado); y **nuevos inscritos** (total y por carrera/mes) cuando se cargue ese archivo.
- **Degradación por disponibilidad:** con solo `Registro molinetes` el informe funciona (flujo, afluencia, carrera, denegaciones); la **tasa de asistencia** aparece al cargar `BD Estudiantes`; el bloque de **nuevos inscritos** aparece al cargar `Nuevos inscritos`.
- **Identidad de persona:** dentro del archivo de molinetes, `ID` (numérico interno del dispositivo) identifica de forma estable a cada persona; se usa para deduplicar por día y por período. No se requiere cruzar con la BD (el `ID` del molinete no coincide con el `Código`/`Carnet` académico, pero eso es irrelevante para el alcance resuelto).
- **Idioma:** español. **Sin backend:** el origen son archivos, no un servicio en tiempo real.

## Brand Commitments

Marca **UNIFRANZ** (Universidad Privada Franz Tamayo), tagline "Internacionalízate". Logo entregado en `public/images/logoUnifranz.png` (logotipo blanco con trazo **naranja** sobre fondo **negro**). El informe debe respetar esta identidad institucional, tomando el naranja como acento de marca. **Tema claro/oscuro con interruptor** (claro por defecto, escena de oficina/impresión; oscuro afín al negro de marca).

**Dirección visual (preferencia estándar, elegida por el usuario):** dashboard institucional canónico ejecutado en serio, sin ironía. Fondo neutro, **un** acento (naranja UNIFRANZ), tarjetas KPI, barras por carrera, área/línea por hora y tabla de denegaciones. **Vara de calidad:** el nivel de oficio de **Linear** (jerarquía sobria, densidad cómoda, detalle preciso) y **Vercel/Observable** (claridad de visualización de datos). La tipografía y tokens definitivos se registran en DESIGN.md al terminar el build.

## Evidence on Hand

- **Archivos de datos reales** en `archives/`: `Registro molinetes.xls`, `BD Estudiantes General.xlsx`, `Nuevos inscritos.xlsx` (esquema verificado; ver Capabilities and Constraints).
- **Activo de marca:** `public/images/logoUnifranz.png`.
- Datos personales sensibles reales (nombres de estudiantes, celulares, deuda): manejar con cuidado; no publicarlos fuera del entorno ni fabricar registros adicionales presentados como reales.

## Product Principles

1. **La exportación real manda.** El esquema de datos y las métricas se ajustan al archivo ZKTeco real, no a suposiciones.
2. **Una página, una lectura.** Todo el resumen debe entenderse de un vistazo, sin navegación ni scroll interminable.
3. **Responder las cuatro preguntas:** cuántos, cuándo, de qué carrera, y quiénes están bloqueados por deuda.
4. **Respetar la identidad institucional** una vez entregada; nada de marca inventada mientras tanto.
5. **Nada de datos fabricados** presentados como reales.

## Accessibility & Inclusion

No se estableció un requisito de accesibilidad específico del producto. Por defecto, el informe debe ser legible en español, con contraste suficiente y apto para impresión.
