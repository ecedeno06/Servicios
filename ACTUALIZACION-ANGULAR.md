# Plan: Actualizar Angular 18 -> version mas reciente (Frontend)

Fecha: 2026-11-09
Objetivo: subir `frontend/` de Angular 18.2.14 a la version mas reciente
(22.x al momento de este analisis), sin romper funcionalidad, migrando de a
una major version por vez.

## 1. Diagnostico del punto de partida (ya relevado en el codigo real)

Riesgo general: **bajo**. El proyecto ya esta casi al dia con los patrones
modernos de Angular, lo que elimina de antemano la mayoria de los dolores
tipicos de una migracion de varias majors:

- 100% standalone, cero `NgModule` en todo `src/`.
- Cero `*ngIf`/`*ngFor`/`*ngSwitch` -- ya migrado al control flow nuevo
  (`@if`/`@for`/`@switch`).
- Ya usa el builder `@angular-devkit/build-angular:application` (esbuild),
  no el builder viejo basado en webpack -- esa migracion (la mas dolorosa
  tipicamente en saltos de major) ya esta hecha (ver `angular.json`).
- Ya usa `provideHttpClient(withInterceptors([...]))`, no
  `HttpClientModule` (ver `app.config.ts`).
- Ya usa signals (`signal`/`computed`/`effect`, usados en 33 archivos).
- Cero librerias de UI de Angular acopladas a la version (no Material, no
  NgRx, no SSR configurado). Las unicas dependencias de terceros
  (`leaflet`, `pdfmake`, `exceljs`) son agnosticas al framework.
- Cero tests (`*.spec.ts` no existen en el proyecto), asi que no hay suite
  de Karma/Jasmine que se pueda romper con el cambio de test runner.
- No se encontro ningun uso de API ya deprecada/removida: cero
  `ComponentFactoryResolver`, cero `APP_INITIALIZER`, cero
  `HttpClientModule`, cero flags `static` en `ViewChild`.
- 3 componentes todavia usan `@Input()`/`@Output()` por decorador (en vez
  de `input()`/`output()` basados en signals) -- siguen funcionando igual
  en toda la linea 18-22, no es un bloqueante ni algo obligatorio a migrar.
- Mezcla de DI por constructor (62 archivos) y `inject()` (4 archivos) --
  ambos estilos siguen soportados, no hay nada que forzar a cambiar.

## 2. Lo que si hay que tocar/validar en el camino

1. **TypeScript**: hoy en `~5.5.0`; cada major de Angular exige una
   version minima mas nueva de TS (Angular 22 pide 5.9+). Riesgo bajo, se
   detecta al toque corriendo `npx tsc --noEmit -p tsconfig.app.json`
   despues de cada paso.
2. **Una major a la vez**: Angular no soporta saltar directo de 18 a 22.
   Hay que correr, en orden, algo como:
   ```
   npx ng update @angular/core@19 @angular/cli@19
   npx ng update @angular/core@20 @angular/cli@20
   npx ng update @angular/core@21 @angular/cli@21
   npx ng update @angular/core@22 @angular/cli@22
   ```
   Cada corrida de `ng update` aplica sus propios *schematics* automaticos
   (ajustan `package.json`, `angular.json`, y reescriben codigo donde haga
   falta). Esto es mas una cuestion de tiempo/proceso que de reescritura
   manual, dado el diagnostico de la seccion 1.
3. **Node**: la maquina de desarrollo tiene Node 24.15, que el Angular CLI
   18 marca como "Unsupported". Las versiones nuevas de Angular en general
   *suben* el piso minimo de Node soportado (p.ej. 20.19+/22.12+), asi que
   lo mas probable es que esta advertencia se resuelva sola al subir (a
   confirmar en cada paso con `npx ng version`).
4. **Zone.js**: sigue siendo el default en Angular 22, no hay migracion
   obligatoria. Pasar a *zoneless* (`provideZonelessChangeDetection()`) es
   **opcional** y queda fuera del alcance de esta migracion -- se podria
   evaluar como un esfuerzo aparte, deliberado, mas adelante.

## 3. Procedimiento paso a paso (por cada major: 19 -> 20 -> 21 -> 22)

Para cada version objetivo:

1. `git status` limpio antes de empezar; trabajar sobre una rama aparte
   (no directo sobre `main`) hasta verificar que todo compila y corre.
2. Correr `npx ng update @angular/core@<N> @angular/cli@<N>` dentro de
   `frontend/`.
3. Revisar el diff que dejo el schematic (`git diff`) -- confirmar que los
   cambios son los esperados (versiones en `package.json`, ajustes menores
   en `angular.json`/config si aplica).
4. `npx tsc --noEmit -p tsconfig.app.json` -- cero errores de tipos.
5. `npx ng build --configuration development` -- build real sin errores
   (no solo warnings preexistentes ya conocidos, ver nota abajo).
6. Levantar el frontend localmente (`npm start` / `ng serve`) y hacer un
   smoke test manual de las pantallas mas representativas (login,
   dashboard, un CRUD con tabla+filtros, un modal con adjuntos/PDF/Excel,
   el mapa de Leaflet) -- cubre los puntos de integracion mas sensibles a
   romperse en un upgrade (routing, HTTP, renderizado condicional, libs de
   terceros).
7. Solo si todo lo anterior pasa: commit de ese paso especifico (un commit
   por major version, no un commit gigante al final) y recien ahi segur
   con la siguiente major.
8. Repetir 2-7 para la siguiente version.

Nota: hoy el build ya deja dos warnings preexistentes, no relacionados con
Angular en si (`p.contactos[0]?.nombre` -- optional chaining innecesario
en `servicios-proveedores.component.html`). No son bloqueantes; no hace
falta "limpiarlos" como parte de esta migracion salvo que se pida aparte.

## 4. Despliegue

Una vez completados los 4 saltos y validado localmente:

- Push a `main` (Vercel reconstruye el frontend solo).
- El backend (Node/Express en Render) **no se ve afectado** por esta
  migracion -- es un cambio exclusivo de `frontend/`.
- Verificar el sitio ya desplegado en Vercel (login + 2-3 pantallas clave)
  antes de dar la migracion por cerrada.

## 5. Aclaracion sobre el alcance de este analisis

Angular saco 4 major versions (19 a 22) despues del corte de conocimiento
de este asistente, asi que el detalle exacto de breaking changes version
por version no esta memorizado de antemano -- el camino correcto, seguido
en este plan, es dejar que `ng update` aplique sus schematics oficiales en
cada paso y verificar con build + smoke test real, en vez de anticipar de
memoria que cambio en cada release.

## Pendiente

- Definir cuando se arranca (no se inicio la migracion todavia -- este
  documento es el plan guardado para ejecutar cuando se decida).
