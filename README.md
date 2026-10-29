DR1P STORE — Tienda online con checkout por WhatsApp

## Desarrollo local
Doble click en `iniciar-tienda.bat` o ejecutá:
```
node backend/server.js
```
Luego abrí `http://localhost:3000`.

## Deploy en Vercel
1. Subí el proyecto al repo https://github.com/mateomanriquez258/Dr1p.git
   (respetá el `.gitignore`: no subas datos de clientes).
2. En [vercel.com](https://vercel.com), importá ese repositorio como proyecto.
3. Dejá la configuración de salida en `frontend`, como indica `vercel.json`, y desplegá.
4. Cada `push` a GitHub volverá a desplegar el sitio automáticamente.

> Este deploy publica el frontend estático. Vercel no ejecuta `backend/server.js` como servidor persistente; si la tienda necesita guardar pedidos, leads o contactos, hay que adaptar esas rutas a Vercel Functions y usar una base de datos externa. Los archivos JSON locales no sirven como almacenamiento persistente en producción.
