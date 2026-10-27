# Informe de acceso estudiantil

Aplicacion Astro para analizar archivos de acceso ZKTeco.

## Acceso desde la red con Laragon

URL: http://192.168.14.100:9091

Apache de Laragon sirve la carpeta `dist/` en el puerto 9091. La configuracion
de `laragon/ti-informe-zkteco.conf` se instala en
`C:\laragon\etc\apache2\sites-enabled\ti-informe-zkteco.conf`.
El servidor debe conservar la IP `192.168.14.100`.

Al iniciar Apache con "Iniciar todo" en Laragon, el sistema queda disponible.
Para que esto ocurra solamente al abrir Laragon, activar en sus preferencias
la opcion de iniciar todos los servicios automaticamente.
En el propio servidor tambien se puede acceder a http://127.0.0.1:9091.

El firewall debe permitir conexiones entrantes TCP al puerto 9091 para la IP
192.168.14.100 desde la red local. La regla del sistema se llama
`TI-INFORME-ZKTECO-9091`.

Para publicar cambios, ejecutar `npm run build`. Apache sirve los archivos
generados en `dist/`; no hace falta mantener Node o Astro dev ejecutandose.
La entrada antigua de Astro en el Procfile de Laragon se retira para evitar
conflictos con Apache.

Se necesitan las dependencias instaladas (`npm install`) y Node >=22.12.0.
El servidor de desarrollo usa http://127.0.0.1:4321.

## Comandos desde la carpeta del proyecto

```sh
npm run dev          # Iniciar en segundo plano
npm run dev:status   # Consultar estado y URL
npm run dev:logs     # Consultar registros
npm run dev:stop     # Detener Astro
npm run build       # Generar la version estatica en dist/
```

Referencias:
- https://docs.astro.build/en/guides/deploy/
- https://httpd.apache.org/docs/2.4/bind.html
