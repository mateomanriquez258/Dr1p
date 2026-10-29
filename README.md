# DR1P STORE — Tienda online con checkout por WhatsApp

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
3. Dejá Root Directory vacío para que Vercel incluya api/ y backend/; vercel.json publica frontend/.
4. Cada `push` a GitHub volverá a desplegar el sitio automáticamente.

> Las funciones en `api/` se despliegan como Vercel Functions. Para guardar pedidos, leads, contactos y cupones en producción hay que conectar una base de datos persistente; los archivos JSON locales no sirven como almacenamiento de Vercel.

## Base persistente de producción
1. En el proyecto de Vercel, instalá la integración de Supabase Marketplace y elegí un plan gratuito disponible.
2. En Supabase, abrí **SQL Editor** y ejecutá `backend/schema-supabase.sql` una sola vez. El script crea el trabajo de limpieza automática cada 15 minutos.
3. Dejá Root Directory vacío para que Vercel incluya api/ y backend/; vercel.json publica frontend/.
4. Desplegá el proyecto. Las rutas `/api/*` guardan los pedidos, contactos, cupones y el límite de giros en Supabase; el canje y el registro del pedido se confirman en una sola transacción.
5. Si todavía quedan cupones anteriores por migrar, ejecutá node backend/migrate-leads-to-supabase.js con SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY disponibles. Solo se importan códigos sin usar; no se copian correos. Los códigos anteriores reciben 24 horas nuevas.

Los emails continúan guardándose en Formspree. Supabase conserva solo un hash del email durante las 24 horas del límite de giro. El premio lo decide el servidor, hay 500.000 combinaciones aleatorias posibles en total y no se crean por adelantado: solo se guardan los cupones emitidos. Se permite un giro por email cada 24 horas; cada cupón sirve una vez y vence 24 horas después del giro. Los cupones usados también se borran al vencer para respetar ese límite y evitar acumular filas. Los archivos locales de operación están excluidos del despliegue.


