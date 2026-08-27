# Gestion de Horas de Servicio

Aplicacion para controlar las horas de servicio que se ejecutan a los
clientes contra las horas establecidas en cada contrato.

- **Frontend:** Angular 18 (standalone components, signals)
- **Backend:** Node.js + Express (API REST con JWT)
- **Base de datos:** PostgreSQL en Supabase

## Modelo de datos

| Tabla                | Descripcion                                                            |
|-----------------------|-------------------------------------------------------------------------|
| `usuarios`            | Personas que usan el sistema (admin, supervisor, tecnico)              |
| `clientes`             | Clientes a los que se les presta el servicio                           |
| `tipos_servicio`       | Catalogo de servicios (soporte, mantenimiento, consultoria, etc.)       |
| `contratos`            | Contrato firmado por un cliente                                         |
| `contrato_servicios`   | Horas **establecidas** por tipo de servicio dentro de un contrato       |
| `registro_horas`       | Horas **ejecutadas** realmente contra un contrato y tipo de servicio    |

La vista `vista_consumo_horas` calcula, por cada servicio de cada contrato:
horas contratadas, horas ejecutadas y horas disponibles. El frontend usa esto
para el medidor de horas (verde / amarillo / rojo) del dashboard y del
detalle de cada contrato.

## 1. Crear el proyecto en Supabase

1. Entra a https://supabase.com y crea un proyecto nuevo.
2. Ve a **SQL Editor** y pega el contenido de `backend/database/schema.sql`,
   luego ejecutalo. Esto crea todas las tablas, la vista y los triggers.
3. Ve a **Project Settings > Database > Connection string > URI** y copia la
   cadena de conexion (usala en `DATABASE_URL` mas abajo). Si vas a producción,
   usa el connection pooler (puerto 6543) en vez de la conexion directa.

## 2. Backend (Node.js + Express)

```bash
cd backend
cp .env.example .env
# Edita .env y coloca tu DATABASE_URL de Supabase y un JWT_SECRET seguro
npm install
npm run dev        # http://localhost:3000
```

### Crear el primer usuario administrador

Como `/api/auth/register` requiere estar autenticado como admin, crea el
primer usuario directamente con una llamada temporal (o inserta el hash a
mano). La forma mas facil:

```bash
# Dentro de backend/, con el servidor corriendo:
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Administrador","email":"admin@empresa.com","password":"Admin123!","rol":"admin"}'
```

> Nota: la ruta de registro esta protegida (`requireAuth, requireRol('admin')`)
> para evitar que cualquiera cree usuarios. Para el primer usuario, comenta
> temporalmente ese middleware en `backend/src/routes/auth.routes.js`, crea el
> admin, y vuelve a dejarlo activo. Alternativamente inserta el registro
> directamente en Supabase con una contrasena ya hasheada con bcrypt.

### Endpoints principales

```
POST   /api/auth/login
GET    /api/auth/me
POST   /api/auth/register            (solo admin)

GET    /api/clientes
POST   /api/clientes
PUT    /api/clientes/:id
DELETE /api/clientes/:id

GET    /api/tipos-servicio
POST   /api/tipos-servicio
PUT    /api/tipos-servicio/:id
DELETE /api/tipos-servicio/:id

GET    /api/contratos
GET    /api/contratos/:id            (incluye servicios + consumo de horas)
POST   /api/contratos
PUT    /api/contratos/:id
DELETE /api/contratos/:id
POST   /api/contratos/:id/servicios              (asignar horas por servicio)
PUT    /api/contratos/:id/servicios/:servicioId
DELETE /api/contratos/:id/servicios/:servicioId

GET    /api/horas                    (?contrato_id=&tipo_servicio_id=&usuario_id=&desde=&hasta=)
POST   /api/horas                    (registrar horas ejecutadas)
PUT    /api/horas/:id
DELETE /api/horas/:id
GET    /api/horas/consumo            (resumen de todos los contratos)
GET    /api/horas/consumo/:contratoId

GET    /api/usuarios                 (solo admin)
POST   /api/usuarios
PUT    /api/usuarios/:id
DELETE /api/usuarios/:id
```

## 3. Frontend (Angular)

```bash
cd frontend
npm install
npm start           # http://localhost:4200
```

Si tu backend no corre en `http://localhost:3000/api`, ajusta
`src/environments/environment.ts`.

## 4. Flujo de uso

1. Inicia sesion con el usuario administrador.
2. Crea **clientes** y el **catalogo de tipos de servicio**.
3. Crea un **contrato** para un cliente.
4. Dentro del contrato, **asigna horas por tipo de servicio** (ej. 40 horas
   de soporte tecnico, 20 horas de mantenimiento).
5. Desde **Registro de horas**, cada tecnico/supervisor va registrando las
   horas realmente ejecutadas contra ese contrato y servicio. El sistema
   valida que exista una bolsa de horas asignada antes de permitir el
   registro, y el dashboard muestra en tiempo real cuanto se ha consumido.

## Roles

- **admin**: acceso total, incluida la gestion de usuarios.
- **supervisor**: gestiona clientes, contratos, servicios y horas.
- **tecnico**: registra sus propias horas ejecutadas.

## Despliegue sugerido

- Backend: Render, Railway, Fly.io o cualquier servicio Node.js (usa la
  `DATABASE_URL` de Supabase con `sslmode=require`).
- Frontend: Vercel, Netlify o Cloudflare Pages (`ng build` genera
  `dist/horas-servicio-frontend`).
- Actualiza `CORS_ORIGIN` en el backend y `apiUrl` en
  `environment.prod.ts` con las URLs finales.
