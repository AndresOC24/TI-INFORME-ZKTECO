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
- El personal de TI **exporta manualmente** los archivos y los usa como fuente. No hay conexión en vivo a API/SDK ni base de datos intermedia (a la fecha); lo único que persiste el servidor son los dos archivos de referencia que se registran en `/registrar`.
- El consumo es de **revisión/análisis**: leer el resumen, no editar registros.
- El log de molinetes registra **solo eventos de "Entrada"** y de **Salida**, e incluye no solo estudiantes sino también `VISITA`, `DOCENTE` y `ADMINISTRATIVOS` los cuales estos ultimos 3 se deben de excluir para el resumen final, solo se debe de tomar en cuenta a los Estudiantes, que son todos aquellos que tienen en nombre del departamento lo siguiente: ADM, AHT, ARQ, BYF, CPU, DER, DGP, ENF, GAC, ICO, MED, ODO, PER, PSI, PYM, SIS.
- Existe 4 molinetes identificados con 4 tipos de direcciones diferentes las cuales son: 192.168.5.106, 192.168.5.110, 192.168.5.111, 192.168.5.112. Cada una de ella luego tiene una denominacion de un -1, -2, -3, o hasta -4, luego todos tiene Entrada o Salida, exepto uno, que es la 192.168.5.106, en esta la que dice 192.168.5.106-1 se la considera Entrada, y 192.168.5.106-2 se la considera Salida.

## Capabilities and Constraints

Cuatro archivos reales en `archives/` (verificados contra el export de septiembre de 2026):

1. **`eventos.xls`** — hoja `Todos los Eventos`, 86 915 eventos (rango 2026-09-01 → 2026-09-11), 2 426 estudiantes distintos. Cabecera en la fila 2. Columnas: `Tiempo`, `Nombre de Área` (siempre "Entrada" — **NO indica dirección, ignorar**), `Nombre de Dispositivo` (IP), `Punto del Evento`, `Descripción del Evento` (`Apertura con verificación normal` 77 %, `Usuario no registrado` 15 %, `Deshabilitada` 7 %, y eventos de sistema), `Nivel de Evento`, `ID` (id interno del dispositivo, **numérico**), `Nombre`, `Apellido`, `Tarjeta`, `Nombre de Departamento` (código de carrera + VISITA/DOCENTE/ADMINISTRATIVOS), `Nombre de Lector` (**mal etiquetado, ignorar para dirección**), `Modo de Verificación` (Huella/Tarjeta).

   - **Dirección (Entrada/Salida):** se deriva del texto de **`Punto del Evento`**. Si contiene "Entrada"/"Salida" (sin distinguir mayúsculas), esa es la dirección. Excepción `192.168.5.106` (sin la palabra): `106-1` = Entrada, `106-2` = Salida. Ojo: `192.168.5.112` tiene la numeración invertida respecto a los otros molinetes, pero su `Punto del Evento` trae la palabra explícita, así que se respeta el texto. Resultado verificado: **49 215 entradas / 50 375 salidas** (410 eventos de sistema sin dirección se descartan).
   - **Filtro de estudiantes:** para el resumen se cuentan **solo estudiantes**, es decir filas cuyo `Nombre de Departamento` esté en `{ADM, AHT, ARQ, BYF, CPU, DER, DGP, ENF, GAC, ICO, MED, ODO, PER, PSI, PYM, SIS}` (16 carreras). Se **excluyen** `VISITA`, `DOCENTE`, `ADMINISTRATIVOS` y vacíos. Verificado: estudiantes = **33 964 entradas / 35 611 salidas**.
2. **`DB_Estudiantes-10_09_2026.xls`** — **2 760 estudiantes activos** de la gestión II/2026, cabecera en la fila 1. Relevantes: `Carrera` (17 códigos, 16 tras unificar DDP→DGP), `Código` (académico, p. ej. `ADM14512233`), `Apellido Paterno` / `Apellido Materno` / `Nombre(s)`, `Gest. Ingreso`, `Deuda Molinete`. Se usa para el **total de activos** (denominador de la asistencia) y para poner carrera y CI a cada persona vista en el molinete.

   - **El CI es la parte numérica del `Código`** (`ADM14512233` → `14512233`). La columna **`Carnet` NO es el CI**: trae montos de beca (250, 150, 100…). 
   - **Ya no existe la columna `Gestión`** (Nuevo/Antiguo) de los exports viejos; en su lugar está `Gest. Ingreso`, la gestión de ingreso (`0I/26` = I-2026, `II/26` = II-2026).
   - **Nuevos inscritos = `Gest. Ingreso` exactamente igual a `GESTION_ACTUAL`** (`parse.js`), hoy `II/2026` → **170**; todo lo demás es antiguo (2 590), incluidas las 5 matrículas adelantadas a `0I/27`. La constante es el **único** lugar donde se define la gestión: se cambia esa línea al empezar cada gestión. Acepta año de 2 o 4 cifras y las dos grafías del primer semestre (`I/2026`, `0I/2026`). **No depende del rango de fechas** que se esté mirando en el informe.

3. **`Usuarios-Estudiantes.xls`** — hoja `Usuarios`, **3 384 usuarios** dados de alta en los molinetes (todos `ESTUDIANTE`), cabecera en la fila 2. Es el **puente de identidad**: los eventos traen un `ID` interno del dispositivo y ningún CI, y este archivo traduce ese `ID` a `Documento / Cédula` (el CI), que sí existe en la BD académica. 17 filas sin CI. El padrón es **acumulativo**: incluye egresados y retirados, por eso tiene más filas que la BD de la gestión.
4. **`Nuevos inscritos.xlsx`** — hoja `NUEVOS`, **164 filas útiles**, cabecera en la fila 3 (títulos "ADMISIONES 2.2026 / SEDE SANTA CRUZ" en las filas 1-2). Datos de admisión: carrera, código, `MES` de inscripción, datos personales, canal, asesor, etc. Aporta el conteo de nuevos inscritos por carrera y por mes.

- **Dos vistas.** `/` redirige a **`/principal`**, el informe: una sola zona de carga, la del **export de molinetes**, que es lo que se sube en cada consulta. **`/registrar`** administra los **archivos de referencia** (BD de estudiantes y padrón del ZKTeco), que cambian cada varios meses. Se navega entre las dos con un botón en la cabecera.
- **Interacción principal:** se **carga el archivo de molinetes** desde el navegador y todas las métricas se **recalculan en el cliente**. La BD y el padrón ya no se vuelven a subir: `/principal` los pide al servidor al arrancar.
- **Persistencia de los archivos de referencia (cambio de alcance).** El producto **ya no es solo cliente**: hay un backend mínimo (adaptador `@astrojs/node`) con tres endpoints — `GET /api/archivos` (qué hay registrado), `POST /api/archivos` (registrar/reemplazar) y `GET /api/archivos/:tipo` (devolver el archivo para parsearlo en el navegador). Los archivos viven en la carpeta `archives/` (configurable con `ARCHIVES_DIR`).
  - **El tipo se deduce del contenido, no del nombre ni de la zona donde se soltó.** Se leen solo las primeras 12 filas (`readHeader`), que es lo que necesita `detectKind`, para no parsear entero un export de varios MB.
  - Subir un archivo **reemplaza al anterior de ese tipo**, aunque se llame distinto: se escribe a un temporal, se renombra y recién entonces se borra el viejo, así un corte a mitad no deja a la carpeta sin un archivo válido.
  - Un archivo cuyo formato no corresponde **se rechaza y no se escribe nada**, con un mensaje que dice qué era en realidad («Ese archivo es "Registro de molinetes", no "BD de estudiantes"»).
  - No hay manifiesto que mantener: al arrancar se **escanea `archives/`** y se detecta cada archivo, así que los que ya estaban antes de existir esta pantalla se reconocen solos.
  - **Degradación:** si el servidor no responde, `/principal` igual calcula el informe con lo que da el export de molinetes y lo dice en pantalla.
- **Período dinámico:** el rango visualizado **no es fijo**; se deriva del `Tiempo` mínimo y máximo del archivo cargado y se muestra explícitamente ("desde … hasta …"). Todo el resumen depende de las fechas que contenga el archivo.
- **Salida:** una página única de resumen (no app multi-vista; no PDF como requisito, aunque una página web es imprimible).
- **Tres archivos en uso, con roles distintos:**
  - `eventos` = fuente **primaria**, se sube en **`/principal`** cada vez que se quiere mirar un período. No se guarda en el servidor: es distinto en cada consulta.
  - `DB_Estudiantes` = **total de estudiantes activos** (2 760). Se registra en **`/registrar`**. Aporta el **denominador** de la asistencia, y la carrera y el CI de cada persona.
  - `Usuarios-Estudiantes` = **padrón del ZKTeco** (3 384). Se registra en **`/registrar`**. Traduce el `ID` del molinete a CI; sin él el cruce cae a solo-nombre.
  - `Nuevos inscritos` = **fuera del alcance por ahora**, a pedido: se quitaron su zona de carga y su panel de admisiones. `parseNuevos` sigue en `parse.js`, así que reponerlo es agregar su entrada en `TIPOS` y volver a poner el markup.

- **Identidad de la persona (cruce de los tres archivos).** Los eventos traen un `ID` interno del dispositivo y ningún CI; la BD trae CI y carrera pero ningún `ID`. El cruce va en dos pasos, en este orden:
  1. **Por CI**, vía el padrón: `ID` del evento → `Documento / Cédula` → `Código` de la BD. Resuelve **2 108** de las 2 426 personas del export de septiembre.
  2. **Por nombre canónico**, cuando el CI no coincide o falta: **mayúsculas, sin tildes, Ñ→N, sin puntuación y con las palabras ordenadas alfabéticamente**. Ordenarlas hace el cruce inmune a que la BD parta el nombre en tres columnas (paterno/materno/nombres) y el ZKTeco en dos. Rescata **25** personas más que por CI se perderían (CI mal cargado en uno de los dos sistemas: `VALLEJOS ZAMBRANA KARINA` figura como `13431463` en el molinete y `13431453` en la BD).
  - El CI se normaliza tomando el **primer bloque de dígitos** sin ceros a la izquierda: en los archivos reales aparece con sufijo (`892333-1G`, `12959610-OLD`) y con relleno (`0027317` ≡ `27317`).
  - Verificado: las 2 760 filas de la BD producen 2 760 claves de nombre distintas, así que **no hay colisiones** y el cruce por nombre es seguro. Un cruce difuso (Jaccard ≥ 0,6) no recupera a nadie más y sí produce falsos positivos entre hermanos, por eso **no** se usa.
  - Cobertura total: **2 133 / 2 426** personas (87,9 %). Sin el padrón, solo por nombre, bajan a 2 110.

- **Salidas sin entrada (anomalía del log, SIN resolver).** El export trae **2 805 salidas más que entradas** de estudiantes (20 492 vs 23 297 en 11 días). El desbalance por molinete:

  | Molinete | Entradas | Salidas | Dif. |
  |---|---:|---:|---:|
  | 192.168.5.110 | 13 424 | 13 460 | −36 |
  | 192.168.5.112 | 2 005 | 1 419 | +586 |
  | 192.168.5.111 | 3 558 | 5 005 | −1 447 |
  | **192.168.5.106** | **1 505** | **3 413** | **−1 908** |

  El `110` cierra casi perfecto, así que el método de derivar la dirección funciona. El mayor aporte al desbalance es el **`106`, justamente el único molinete donde la dirección NO se lee del texto** sino que se infiere por convención (`106-1` = Entrada, `106-2` = Salida): `106-2` tiene más del doble de eventos que `106-1`. Consecuencia visible: el 1 de septiembre hay **196 estudiantes con salidas y ninguna entrada**, varios con salidas repetidas (`16h, 18h, 18h, 22h`) — imposible sin haber entrado. Por eso la asistencia se define sobre entradas y no sobre «visto en el molinete». **Queda pendiente confirmar con TI si la convención del `106` es correcta**; si estuviera invertida, el desbalance global pasa de −2 805 a +1 011.

- **Códigos de carrera que son la misma carrera.** `DDP` y `DGP` son ambos **Diseño Gráfico**: la universidad cambió el código, así que las cohortes viejas quedaron en `DGP` y las nuevas entran como `DDP` (verificado: `DGP` no tiene ni un ingreso en `II/26`; `DDP` tiene 20). Se unifican con `CAREER_ALIASES` en `parse.js` — `{ DDP: 'DGP' }` — aplicado al entrar el código al sistema, de modo que no salgan dos barras de la misma carrera. Dejar ese objeto vacío devuelve los códigos separados. `DDP` sigue en `STUDENT_CAREERS` porque los exports viejos lo traen como departamento y hay que reconocerlo antes de unificar.

- **Ausente ≠ no identificado.** El archivo de eventos cubre **solo el rango de fechas que se pidió al exportarlo**, así que un estudiante activo que no aparece casi nunca es un fallo del cruce: es alguien que **no vino** en esas fechas. El informe separa las dos cosas explícitamente:
  - **asistieron** — activos con al menos una **ENTRADA** en el rango (2 099 en el export de septiembre). Es la misma definición que la tarjeta «Ingresos», para que los dos números del resumen no se contradigan. No cuenta a quien solo registra salidas (ver «salidas sin entrada» abajo) ni los intentos denegados: al bloqueado por deuda el molinete no lo dejó pasar.
  - **sin registro en el rango** — activos que no aparecen (627); `asistieron + sin registro = total de activos`, siempre;
  - **descartados** — personas vistas en el molinete que **no** están en la BD de la gestión (293 en el export de septiembre: egresados, retirados, fichas viejas del padrón, personal cuya alta quedó bajo el departamento de estudiantes). **No se cuentan en ninguna métrica**: ni en los totales, ni en la afluencia por hora, ni por carrera, ni en los bloqueados. Verificado que no es un fallo del cruce: de esas 293, **0** coincidían por nombre con alguien de la BD.
  - El descarte necesita una BD contra la cual decidir. **Sin BD cargada se cuenta todo** y reaparece la categoría `S/C` («sin carrera identificada»): es preferible un informe completo sin carreras a uno vacío.
  - Efecto en el export de septiembre: ingresos únicos 13 248 → **12 703**, bloqueados 273 → **272**, y ahora la **suma por carrera cierra exactamente** con el total de ingresos, cosa que antes no pasaba.
- **Regla de conteo diario (dedup):** un estudiante puede entrar y salir varias veces el mismo día; para los totales **cuenta como 1 entrada y 1 salida por día** (deduplicado por `ID` + día + dirección). Los intentos denegados ("Deshabilitada") **no** cuentan como ingreso efectivo. Verificado con el export de septiembre: **13 248 ingresos únicos** / 13 922 salidas únicas en 10 días.
- **Tasa de asistencia:** estudiantes **activos identificados** que **entraron** al menos una vez ÷ total de activos de la BD. El numerador sale del cruce, **no** de los `ID` crudos del molinete: por la puerta también pasa gente que ya no está inscrita, y contarla inflaba la tasa (2 426/2 760 = 87,9 % aparente frente al **76,1 %** real, 2 099/2 760).
- **Eventos crudos → afluencia horaria:** los múltiples pasajes por persona/hora **no** se descartan; se usan para estimar en qué franjas hay mayor afluencia de estudiantes dentro de la universidad (patrón por hora / aforo aproximado combinando entradas y salidas).
- **Bloqueados por deuda (resuelto):** son las filas con `Descripción del Evento` = **"Deshabilitada"** cuyo `Nombre de Departamento` es una carrera de estudiante. El conteo de personas se deduplica por `ID`. Verificado en la muestra: 7 344 eventos denegados = **848 estudiantes distintos**. (Ojo: la palabra vive en `Descripción del Evento`; `Nivel de Evento` es Normal/Excepción/Alarma.)
- **Listado de bloqueados (spec):** conteo por carrera + total, siempre visible. Además un **apartado colapsable (oculto por defecto)** con **nombre + CI** de cada estudiante bloqueado, **exportable** (descarga CSV/Excel). Sin nº de intentos denegados. El **CI** no está en molinetes ni en la columna `Carnet`; es la **parte numérica del `Código`** de la BD (7–8 dígitos; `ADM14512233` → `14512233`). El CI sale de la ficha ya resuelta por el cruce de identidad (CI del padrón o nombre canónico), no de una búsqueda aparte: así el listado hereda la misma cobertura que el resto del informe — verificado **272 de 273** bloqueados con CI. Sin BD cargada se listan los nombres sin CI.
- **Métricas objetivo:** volumen total (entradas/salidas únicas del período) como dato protagonista; **tasa de asistencia** (entrantes únicos ÷ total de estudiantes activos de la BD, por día y del período); afluencia por hora; desglose por carrera; bloqueados por deuda (conteo + listado); y **nuevos inscritos** (total y por carrera/mes) cuando se cargue ese archivo.
- **Degradación por disponibilidad:** con solo el export de molinetes el informe funciona (flujo, afluencia, denegaciones); la **carrera, el CI y la tasa de asistencia** aparecen cuando está registrada la `BD de estudiantes`; el **cruce por CI** (y con él la mejor cobertura) cuando está el `padrón del ZKTeco`. La línea de estado bajo la zona de carga dice siempre qué hay y qué falta.
- **Identidad de persona:** dentro del archivo de molinetes, `ID` (numérico interno del dispositivo) identifica de forma estable a cada persona; se usa para deduplicar por día y por período. No se requiere cruzar con la BD (el `ID` del molinete no coincide con el `Código`/`Carnet` académico, pero eso es irrelevante para el alcance resuelto).
- **Idioma:** español. **Backend mínimo:** solo guarda y devuelve los dos archivos de referencia; no hay base de datos ni conexión en vivo al ZKTeco, y todo el cálculo del informe sigue ocurriendo en el navegador.

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
