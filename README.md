# Informe de acceso estudiantil

Aplicacion Astro para analizar archivos de acceso ZKTeco.

## Estudiantes y docentes

En `/principal`, las opciones **Estudiantes** y **Docentes** usan el mismo archivo
de molinetes y conservan el rango de fechas al alternar. El directorio docente
se puede consultar antes de cargar eventos: incluye nombre, CI, carrera,
telefono, correo y condicion antiguo/nuevo. La ficha muestra entradas, salidas,
accesos denegados y el detalle de las marcaciones del periodo.

`DOCENTES.xlsx` se registra en `/registrar`, junto con la BD de estudiantes y el
padron del ZKTeco. Se reconoce por las columnas de nombre de docente, CI y
CARRERA. Los CI repetidos se unifican y los nombres ambiguos requieren cruce por
CI. Los eventos con rol DOCENTE sin coincidencia se muestran como tales; no se
inventan datos de contacto ni se interpreta la falta de entradas como ausencia.

El archivo original queda en la raiz del proyecto. La copia registrada inicial
en `archives/DOCENTES.xlsx` conserva las filas con datos de la hoja principal,
sin las filas vacias de formato ni la hoja auxiliar repetida.

Pruebas del procesamiento: `npm test`.

## Acceso desde la red con Laragon

URL: http://192.168.14.100:9091

Apache de Laragon sirve la carpeta `dist/client/` en el puerto 9091 y envia
las peticiones `/api/` a Node en `127.0.0.1:4322`. Requiere los modulos
`mod_proxy` y `mod_proxy_http`, que la configuracion carga si hace falta. La configuracion
de `laragon/ti-informe-zkteco.conf` se instala en
`C:\laragon\etc\apache2\sites-enabled\ti-informe-zkteco.conf`.
El servidor debe conservar la IP `192.168.14.100`.

Al iniciar Apache con "Iniciar todo" en Laragon, las paginas quedan disponibles.
Para que esto ocurra solamente al abrir Laragon, activar en sus preferencias
la opcion de iniciar todos los servicios automaticamente.
En el propio servidor tambien se puede acceder a http://127.0.0.1:9091.

El firewall debe permitir conexiones entrantes TCP al puerto 9091 para la IP
192.168.14.100 desde la red local. La regla del sistema se llama
`TI-INFORME-ZKTECO-9091`.

Para instalar o reparar esta configuracion, ejecutar desde PowerShell como administrador:

```powershell
npm run build
powershell -NoProfile -ExecutionPolicy Bypass -File .\laragon\configure.ps1
```

El instalador respalda la configuracion anterior, instala el sitio en Apache,
permite el puerto 9091 desde la red local y registra el inicio automatico de
la API en `C:\laragon\usr\Procfile`. Tambien inicia Node y reinicia Apache.

Para publicar cambios, ejecutar `npm run build` y reiniciar el proceso Node:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\laragon\start-server.ps1 -Restart
```

El registro y la lectura de archivos requieren mantener el servidor Node
ejecutandose. Iniciarlo desde la carpeta del proyecto en PowerShell:

```powershell
$env:HOST = '127.0.0.1'
$env:PORT = '4322'
node dist/server/entry.mjs
```

El proceso `TI-INFORME-ZKTECO API` del Procfile inicia Node en segundo plano
al abrir Laragon. Los registros quedan en `.astro/laragon-node*.log`.
Los archivos se guardan en `archives/`, o en
la ruta indicada por `ARCHIVES_DIR`. El servidor de desarrollo usa otro puerto.

Se necesitan las dependencias instaladas (`npm install`) y Node >=22.12.0.
El servidor de desarrollo usa http://127.0.0.1:4321.

## Comandos desde la carpeta del proyecto

```sh
npm run dev          # Iniciar en segundo plano
npm run dev:status   # Consultar estado y URL
npm run dev:logs     # Consultar registros
npm run dev:stop     # Detener Astro
npm run build       # Generar paginas en dist/client/ y servidor en dist/server/
```

Referencias:
- https://docs.astro.build/en/guides/deploy/
- https://docs.astro.build/en/guides/integrations-guide/node/
- https://httpd.apache.org/docs/2.4/bind.html
- https://laragon.org/docs/easy-to-extend

## Lista unificada de usuarios

En `/registrar` se cargan la BD académica, la lista completa de usuarios del ZKTeco y el Excel actualizado de docentes. Para estudiantes se usa el rol del padrón o, si falta el ID, el departamento del evento. Para docentes manda la pertenencia al Excel actualizado, vinculada por CI o nombre no ambiguo.

La **Lista actualizada de docentes** se carga por separado en `/registrar` y determina quién aparece y el total de docentes. Requiere columnas Docente (o Nombre completo), CI y Carrera; cuenta cada CI una vez y combina sus carreras. ZKTeco solo vincula IDs y completa contactos faltantes. Se incluyen docentes del Excel sin marcaciones y se excluyen usuarios que solo figuran en ZKTeco. Sin este Excel se solicita cargarlo, sin sustituirlo por el padrón.
