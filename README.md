# DR1P STORE — Tienda online con checkout por WhatsApp

## Desarrollo local
Doble click en `iniciar-tienda.bat` o:
```
node backend/server.js
```
Abrir `http://localhost:3000`.

## Deploy en Render (gratis)
1. Subir este proyecto al repo https://github.com/mateomanriquez258/Dr1p.git
   (respetar el `.gitignore`: no subir datos de clientes).
2. En [render.com](https://render.com) → New → Blueprint → seleccionar el repo.
   El `render.yaml` configura todo solo (plan free, `npm start`).
3. Cada `push` a GitHub redespliega automáticamente con la misma URL.

> Nota plan free: la instancia "duerme" tras inactividad (tarda ~30s en
> despertar) y los JSON (`pedidos`/`leads`/`contactos`) se reinician si el
> servicio se recrea. Para persistencia real, agregar un Disk (de pago)
> o migrar a base de datos externa.
