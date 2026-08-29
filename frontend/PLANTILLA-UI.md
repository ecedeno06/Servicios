# Plantilla UI: consola de gestión (Angular standalone)

Guía para reutilizar en otro proyecto el sistema de diseño y la estructura
de este frontend (sidebar + topbar, tablas, paneles laterales tipo drawer,
login). Está pensada para pegar en un proyecto Angular nuevo y adaptar.

## 1. Stack y stack de referencia

- Angular 18+, componentes **standalone** (sin `NgModule`).
- Sintaxis de control de flujo nueva (`@if`, `@for`, `@else`) — requiere Angular 17+.
- Cada componente en **3 archivos separados**: `nombre.component.ts` + `.html` + `.css`
  (aunque el `.css` normalmente queda vacío: casi todo el estilo vive en un
  único `styles.css` global — ver sección 3).
- Sin librería de UI de terceros (Material, PrimeNG, etc.) — todo CSS a mano,
  clases utilitarias simples.
- Tipografías: **Space Grotesk** (títulos) + **Inter** (cuerpo), vía Google Fonts.

## 2. Estructura de carpetas

```
src/
  app/
    core/
      models/         # interfaces TypeScript (modelos de datos)
      services/        # servicios HTTP (uno por entidad, ej. clientes.service.ts)
      guards/          # CanActivateFn (ej. authGuard, superAdminGuard)
      interceptors/     # HttpInterceptorFn (ej. authInterceptor)
    features/
      login/
      layout/           # shell: sidebar + topbar + <router-outlet>
      dashboard/
      <entidad>/        # una carpeta por pantalla CRUD (clientes, usuarios, etc.)
    app.component.ts
    app.routes.ts
    app.config.ts
  environments/
    environment.ts       # apunta a localhost en desarrollo
    environment.prod.ts   # apunta al backend real de produccion
  styles.css              # sistema de diseño global (ver seccion 3)
  index.html
```

Convención de componente (repetida en todos):

```ts
@Component({
  selector: 'app-algo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule /* lo que use */],
  templateUrl: './algo.component.html',
  styleUrl: './algo.component.css',
})
export class AlgoComponent { ... }
```

## 3. Sistema de diseño (`src/styles.css`)

Copiar tal cual a un proyecto nuevo y ajustar solo la paleta de colores en
`:root` si hace falta. Todo lo demás (botones, tablas, drawers, badges,
formularios) queda funcionando igual.

```css
/* =========================================================
   Sistema de diseño - paleta slate + teal, consola de datos
   ========================================================= */

:root {
  /* Paleta */
  --slate-950: #0f172a;
  --slate-900: #141c2e;
  --slate-800: #1c2740;
  --slate-700: #2a3654;
  --slate-500: #64748b;
  --slate-300: #cbd5e1;
  --slate-100: #eef1f6;
  --slate-50:  #f6f8fb;
  --white: #ffffff;

  --teal-600: #0d9488;
  --teal-500: #14b8a6;
  --teal-100: #ccfbf1;

  --amber-500: #f59e0b;
  --amber-100: #fef3c7;

  --red-600: #dc2626;
  --red-100: #fee2e2;

  --green-600: #16a34a;
  --green-100: #dcfce7;

  /* Tipografia */
  --font-display: 'Space Grotesk', 'Inter', sans-serif;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

  /* Layout */
  --sidebar-w: 240px;
  --radius: 10px;
  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06);
  --shadow-md: 0 4px 16px rgba(15, 23, 42, 0.10);
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  background: var(--slate-50);
  color: var(--slate-900);
  font-family: var(--font-body);
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4 {
  font-family: var(--font-display);
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--slate-950);
  letter-spacing: -0.01em;
}

h1 { font-size: 22px; }
h2 { font-size: 18px; }
h3 { font-size: 15px; }

p { margin: 0 0 8px 0; }

a { color: var(--teal-600); text-decoration: none; }
a:hover { text-decoration: underline; }

button, input, select, textarea { font-family: inherit; font-size: inherit; }

:focus-visible {
  outline: 2px solid var(--teal-500);
  outline-offset: 2px;
}

/* ---------- Layout ---------- */
.app-shell {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: var(--sidebar-w);
  background: var(--slate-950);
  color: var(--slate-300);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 18px;
  border-bottom: 1px solid var(--slate-800);
}

.sidebar-brand .mark {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--teal-500), var(--teal-600));
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 14px;
}

.sidebar-brand .title {
  font-family: var(--font-display);
  color: white;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
}
.sidebar-brand .subtitle {
  font-size: 11px;
  color: var(--slate-500);
}

.sidebar-nav {
  flex: 1;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-nav a {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 8px;
  color: var(--slate-300);
  font-size: 13.5px;
  font-weight: 500;
  text-decoration: none;
}

.sidebar-nav a:hover { background: var(--slate-900); color: white; }
.sidebar-nav a.active {
  background: var(--slate-800);
  color: white;
  box-shadow: inset 2px 0 0 var(--teal-500);
}

.sidebar-footer {
  padding: 14px 18px;
  border-top: 1px solid var(--slate-800);
  font-size: 12px;
  color: var(--slate-500);
}

.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.topbar {
  height: 60px;
  background: var(--white);
  border-bottom: 1px solid var(--slate-100);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.topbar .user-pill {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}

.user-pill .avatar {
  width: 30px; height: 30px; border-radius: 50%;
  background: var(--teal-100); color: var(--teal-600);
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 12px;
}

.user-pill .avatar-img {
  width: 30px; height: 30px; border-radius: 50%;
  object-fit: cover;
}

.user-menu { position: relative; }

.user-pill-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 8px;
  text-align: left;
}
.user-pill-btn:hover { background: var(--slate-50); }

.dropdown-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 200px;
  background: var(--white);
  border: 1px solid var(--slate-100);
  border-radius: 10px;
  box-shadow: var(--shadow-md);
  padding: 6px;
  z-index: 41;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropdown-item {
  background: none;
  border: none;
  text-align: left;
  padding: 9px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--slate-700, #334155);
  cursor: pointer;
}
.dropdown-item:hover { background: var(--slate-50); }
.dropdown-item-danger { color: var(--red-600); }
.dropdown-item-danger:hover { background: var(--red-100); }

.content {
  padding: 24px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  flex: 1;
}

.page-footer {
  padding: 14px 24px;
  border-top: 1px solid var(--slate-100);
  color: var(--slate-500);
  font-size: 12px;
  text-align: center;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 18px;
  gap: 12px;
  flex-wrap: wrap;
}

.page-header .desc { color: var(--slate-500); font-size: 13px; }

.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.filter-bar .input {
  max-width: 360px;
}

/* ---------- Botones ---------- */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 14px;
  border-radius: 8px;
  border: 1px solid transparent;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-primary { background: var(--slate-950); color: white; }
.btn-primary:hover { background: var(--slate-800); }

.btn-accent { background: var(--teal-600); color: white; }
.btn-accent:hover { background: var(--teal-500); }

.btn-outline { background: white; color: var(--slate-900); border-color: var(--slate-300); }
.btn-outline:hover { background: var(--slate-100); }

.btn-danger { background: var(--white); color: var(--red-600); border-color: var(--red-100); }
.btn-danger:hover { background: var(--red-100); }

.btn-sm { padding: 5px 10px; font-size: 12.5px; }

/* ---------- Cards / stats ---------- */
.card {
  background: var(--white);
  border: 1px solid var(--slate-100);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: 18px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}

.stat-card {
  background: var(--white);
  border: 1px solid var(--slate-100);
  border-radius: var(--radius);
  padding: 16px 18px;
}
.stat-card .label { font-size: 12px; color: var(--slate-500); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
.stat-card .value { font-family: var(--font-display); font-size: 26px; font-weight: 700; color: var(--slate-950); margin-top: 4px; }

/* ---------- Tablas ---------- */
.table-wrap {
  background: var(--white);
  border: 1px solid var(--slate-100);
  border-radius: var(--radius);
  overflow: auto;
}

table.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}

.data-table thead th {
  text-align: left;
  padding: 11px 14px;
  background: var(--slate-50);
  color: var(--slate-500);
  font-weight: 600;
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--slate-100);
  white-space: nowrap;
  user-select: none;
}

.data-table thead th.sortable {
  cursor: pointer;
}

.data-table thead th.sortable:hover {
  color: var(--slate-700, #334155);
}

.data-table tbody td {
  padding: 11px 14px;
  border-bottom: 1px solid var(--slate-100);
  vertical-align: middle;
}

.data-table tbody tr:last-child td { border-bottom: none; }
.data-table tbody tr:hover { background: var(--slate-50); }

.table-actions { display: flex; gap: 6px; justify-content: flex-end; }

.empty-state {
  text-align: center;
  padding: 48px 20px;
  color: var(--slate-500);
}

/* ---------- Badges ---------- */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.badge-green { background: var(--green-100); color: var(--green-600); }
.badge-amber { background: var(--amber-100); color: var(--amber-500); }
.badge-red { background: var(--red-100); color: var(--red-600); }
.badge-slate { background: var(--slate-100); color: var(--slate-500); }

/* ---------- Medidor tipo "gauge" (barra de progreso etiquetada) ---------- */
.hour-gauge { display: flex; flex-direction: column; gap: 4px; min-width: 140px; }
.hour-gauge .track {
  height: 7px;
  border-radius: 999px;
  background: var(--slate-100);
  overflow: hidden;
}
.hour-gauge .fill {
  height: 100%;
  border-radius: 999px;
  background: var(--teal-500);
  transition: width 0.3s ease;
}
.hour-gauge.warn .fill { background: var(--amber-500); }
.hour-gauge.danger .fill { background: var(--red-600); }
.hour-gauge .meta { font-size: 11.5px; color: var(--slate-500); display: flex; justify-content: space-between; }

/* ---------- Formularios ---------- */
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}

.form-group { display: flex; flex-direction: column; gap: 5px; }
.form-group label { font-size: 12.5px; font-weight: 600; color: var(--slate-700); }
.form-group .hint { font-size: 11.5px; color: var(--slate-500); }

.input, select.input, textarea.input {
  padding: 9px 11px;
  border-radius: 8px;
  border: 1px solid var(--slate-300);
  background: var(--white);
  color: var(--slate-950);
  width: 100%;
}
.input:focus { border-color: var(--teal-500); }
.input.invalid { border-color: var(--red-600); }
.error-text { font-size: 11.5px; color: var(--red-600); }

.form-actions { display: flex; gap: 8px; margin-top: 16px; }

/* ---------- Modal / panel lateral (drawer) ---------- */
.overlay {
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: flex-start; justify-content: flex-end;
  z-index: 50;
}
.drawer {
  background: var(--white);
  width: 640px;
  max-width: 100%;
  height: 100vh;
  overflow-y: auto;
  padding: 22px;
  box-shadow: var(--shadow-md);
}
.drawer-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 16px;
}
.drawer-header button.close {
  background: none; border: none; cursor: pointer;
  font-size: 18px; color: var(--slate-500);
}

/* ---------- Login ---------- */
.auth-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at top left, var(--slate-900), var(--slate-950));
}
.auth-card {
  width: 360px;
  background: var(--white);
  border-radius: 14px;
  padding: 32px 28px;
  box-shadow: var(--shadow-md);
}
.auth-logo {
  width: 42px; height: 42px; border-radius: 10px;
  background: linear-gradient(135deg, var(--teal-500), var(--teal-600));
  display: flex; align-items: center; justify-content: center;
  color: white; font-family: var(--font-display); font-weight: 700;
  margin-bottom: 14px;
}
.auth-error {
  background: var(--red-100); color: var(--red-600);
  padding: 8px 12px; border-radius: 8px; font-size: 12.5px; margin-bottom: 12px;
}

/* ---------- Utilidades ---------- */
.flex { display: flex; }
.items-center { align-items: center; }
.gap-6 { gap: 6px; }
.gap-8 { gap: 8px; }
.gap-12 { gap: 12px; }
.mt-16 { margin-top: 16px; }
.text-muted { color: var(--slate-500); }
.text-sm { font-size: 12.5px; }
.w-full { width: 100%; }
```

### `index.html`: fuentes

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
```

### `angular.json`: registrar el CSS global

```json
"styles": ["src/styles.css"],
```

## 4. El "shell": sidebar + topbar (`layout.component`)

Es el componente que envuelve todas las pantallas autenticadas. Tiene:

- Un `<aside class="sidebar">` con marca (`.sidebar-brand`), navegación
  (`.sidebar-nav` con `routerLink`/`routerLinkActive="active"`) y pie
  (`.sidebar-footer`).
- Un `<header class="topbar">` con info contextual a la izquierda y un menú
  de usuario a la derecha (`.user-menu` con dropdown).
- Un `<main class="content">` que envuelve el `<router-outlet>`.
- Un `<footer class="page-footer">`.

**Esqueleto genérico** (`layout.component.html`):

```html
<div class="app-shell">
  <aside class="sidebar">
    <div class="sidebar-brand">
      <div class="mark">XX</div>
      <div>
        <div class="title">Nombre del Producto</div>
        <div class="subtitle">Panel de gestion</div>
      </div>
    </div>

    <nav class="sidebar-nav">
      <a routerLink="/dashboard" routerLinkActive="active">Resumen</a>
      <a routerLink="/entidad-a" routerLinkActive="active">Entidad A</a>
      <a routerLink="/entidad-b" routerLinkActive="active">Entidad B</a>
      @if (auth.usuario()?.rol === 'admin') {
        <a routerLink="/usuarios" routerLinkActive="active">Usuarios</a>
      }
    </nav>

    <div class="sidebar-footer">v1.0</div>
  </aside>

  <div class="main">
    <header class="topbar">
      <div><!-- contexto: empresa activa, breadcrumb, etc. --></div>

      <div class="user-menu">
        <button class="user-pill user-pill-btn" (click)="menuAbierto.set(!menuAbierto())">
          <div class="avatar">{{ iniciales() }}</div>
          <div>
            <div>{{ auth.usuario()?.nombre }}</div>
            <div class="text-muted" style="font-size:11px;">{{ auth.usuario()?.rol }}</div>
          </div>
        </button>

        @if (menuAbierto()) {
          <div class="dropdown-backdrop" (click)="menuAbierto.set(false)"></div>
          <div class="dropdown-menu">
            <button type="button" class="dropdown-item" (click)="auth.logout()">Salir</button>
          </div>
        }
      </div>
    </header>

    <main class="content">
      <router-outlet></router-outlet>
    </main>

    <footer class="page-footer">&copy; {{ anioActual }}</footer>
  </div>
</div>
```

```ts
// layout.component.ts
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
})
export class LayoutComponent {
  anioActual = new Date().getFullYear();
  menuAbierto = signal(false);

  constructor(public auth: AuthService) {}

  iniciales(): string {
    const nombre = this.auth.usuario()?.nombre || '';
    return nombre.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
  }
}
```

## 5. Pantalla de login (`login.component`)

```html
<div class="auth-screen">
  <div class="auth-card">
    <div class="auth-logo">XX</div>
    <h1>Ingresar</h1>
    <p class="text-muted text-sm">Descripcion corta del producto</p>

    @if (error()) {
      <div class="auth-error mt-16">{{ error() }}</div>
    }

    <form [formGroup]="form" (ngSubmit)="enviar()" class="mt-16">
      <div class="form-group">
        <label>Correo electronico</label>
        <input class="input" type="email" formControlName="email" />
      </div>
      <div class="form-group mt-16">
        <label>Contrasena</label>
        <input class="input" type="password" formControlName="password" />
      </div>
      <button class="btn btn-primary w-full mt-16" type="submit" [disabled]="form.invalid || cargando()">
        {{ cargando() ? 'Ingresando...' : 'Ingresar' }}
      </button>
    </form>
  </div>
</div>
```

## 6. Pantalla de listado CRUD (patrón repetido en todas las entidades)

Estructura común a `clientes`, `usuarios`, `tipos-servicio`, etc.:

1. `page-header` con título + descripción + botón "+ Nuevo X" a la derecha.
2. `filter-bar` con un input de búsqueda + botón Filtrar/Limpiar.
3. `table-wrap` > `table.data-table` con las columnas, y una columna final
   de acciones (`table-actions`) con botones Editar/Eliminar.
4. Un panel lateral (`overlay` + `drawer`) que aparece para crear/editar,
   con un `form-group` por campo y `form-actions` al final.

```html
<div class="page-header">
  <div>
    <h1>Entidad</h1>
    <div class="desc">Descripcion de la pantalla</div>
  </div>
  <button class="btn btn-accent" (click)="abrirNuevo()">+ Nueva entidad</button>
</div>

<div class="filter-bar">
  <input class="input" type="text" placeholder="Buscar..."
         [ngModel]="filtroTexto()" (ngModelChange)="filtroTexto.set($event)" (keyup.enter)="aplicarFiltro()" />
  <button class="btn btn-primary" (click)="aplicarFiltro()">Filtrar</button>
  @if (filtro()) { <button class="btn btn-outline" (click)="limpiarFiltro()">Limpiar</button> }
</div>

<div class="table-wrap">
  <table class="data-table">
    <thead><tr><th>Nombre</th><th>Estado</th><th></th></tr></thead>
    <tbody>
      @for (item of itemsFiltrados(); track item.id) {
        <tr>
          <td>{{ item.nombre }}</td>
          <td><span class="badge" [class.badge-green]="item.activo" [class.badge-slate]="!item.activo">
            {{ item.activo ? 'Activo' : 'Inactivo' }}
          </span></td>
          <td class="table-actions">
            <button class="btn btn-outline btn-sm" (click)="abrirEditar(item)">Editar</button>
            <button class="btn btn-danger btn-sm" (click)="eliminar(item)">Eliminar</button>
          </td>
        </tr>
      } @empty {
        <tr><td colspan="3"><div class="empty-state">No hay registros todavia.</div></td></tr>
      }
    </tbody>
  </table>
</div>

@if (panelAbierto()) {
  <div class="overlay" (click)="cerrarPanel()">
    <div class="drawer" (click)="$event.stopPropagation()">
      <div class="drawer-header">
        <h2>{{ editando() ? 'Editar' : 'Nueva' }} entidad</h2>
        <button class="close" (click)="cerrarPanel()">&times;</button>
      </div>
      <form [formGroup]="form" (ngSubmit)="guardar()">
        <div class="form-group">
          <label>Nombre *</label>
          <input class="input" formControlName="nombre" />
        </div>
        <div class="form-group mt-16">
          <label class="flex items-center gap-8">
            <input type="checkbox" formControlName="activo" /> Activo
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn btn-primary" [disabled]="form.invalid">Guardar</button>
          <button type="button" class="btn btn-outline" (click)="cerrarPanel()">Cancelar</button>
        </div>
      </form>
    </div>
  </div>
}
```

## 7. Pantalla de detalle / dashboard (`card`, `stats-grid`, `hour-gauge`)

- `stats-grid` + `stat-card`: fila de métricas resumen arriba de un dashboard.
- `card`: bloque de contenido con borde y sombra suave (usado para
  "Observaciones", "Documentos", secciones dentro de un detalle).
- `hour-gauge`: barra de progreso etiquetada con dos estados de alerta
  (`.warn` ámbar, `.danger` rojo) — útil para cualquier "consumo vs límite"
  (horas, cupos, presupuesto, storage, etc.), no exclusivo de horas.

```html
<div class="stats-grid">
  <div class="stat-card">
    <div class="label">Metrica</div>
    <div class="value">{{ valor() }}</div>
  </div>
</div>

<div class="card">
  <h2 style="margin:0;">Titulo de seccion</h2>
  <p class="mt-16" style="margin-bottom:0;">Contenido...</p>
</div>

<div class="hour-gauge" [class.warn]="pct >= 80 && pct < 100" [class.danger]="pct >= 100">
  <div class="track"><div class="fill" [style.width.%]="pct"></div></div>
  <div class="meta"><span>{{ disponible }} libres</span><span>{{ pct }}% usado</span></div>
</div>
```

## 8. Checklist para aplicarlo a un proyecto nuevo

1. Copiar `styles.css` (sección 3) a `src/styles.css` del proyecto nuevo.
2. Agregar el `<link>` de Google Fonts en `index.html`.
3. Registrar `"styles": ["src/styles.css"]` en `angular.json`.
4. Crear `features/layout/` con el esqueleto de la sección 4, ajustando el
   nombre del producto, las iniciales del `.mark`/`.auth-logo`, y los items
   de `sidebar-nav` a las rutas reales del nuevo proyecto.
5. Crear `features/login/` con el esqueleto de la sección 5.
6. Para cada entidad nueva, copiar el patrón de la sección 6 (listado +
   drawer de alta/edición) y ajustar campos/columnas.
7. Reusar `core/guards/auth.guard.ts` y `core/interceptors/auth.interceptor.ts`
   de este proyecto como base para el manejo de sesión (agregan el
   `Authorization: Bearer` y redirigen a `/login` en 401).
8. Mantener la convención de 3 archivos por componente (`.ts`/`.html`/`.css`)
   aunque el `.css` quede vacío — dejar la puerta abierta a estilos propios
   por componente sin tener que migrar después.
