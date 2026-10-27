# Informe de acceso estudiantil

Aplicacion Astro para analizar archivos de acceso ZKTeco.

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
