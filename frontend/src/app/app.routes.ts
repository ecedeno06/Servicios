import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { superAdminGuard } from './core/guards/super-admin.guard';
import { permisoGuard } from './core/guards/permiso.guard';
import { LayoutComponent } from './features/layout/layout.component';
import { LoginComponent } from './features/login/login.component';
import { RestablecerPasswordComponent } from './features/restablecer-password/restablecer-password.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ClientesComponent } from './features/clientes/clientes.component';
import { TiposServicioComponent } from './features/tipos-servicio/tipos-servicio.component';
import { ContratosComponent } from './features/contratos/contratos.component';
import { ContratoDetalleComponent } from './features/contratos/contrato-detalle.component';
import { RegistroHorasComponent } from './features/horas/registro-horas.component';
import { ReporteHorasComponent } from './features/reportes/reporte-horas.component';
import { ReporteServiciosComponent } from './features/reportes/reporte-servicios.component';
import { UsuariosComponent } from './features/usuarios/usuarios.component';
import { EmpresasComponent } from './features/empresas/empresas.component';
import { PoliticaPasswordComponent } from './features/politica-password/politica-password.component';
import { AuditoriaSesionesComponent } from './features/auditoria-sesiones/auditoria-sesiones.component';
import { EquiposComponent } from './features/equipos/equipos.component';
import { EquiposAsignadosComponent } from './features/equipos-asignados/equipos-asignados.component';
import { RolesPermisosComponent } from './features/roles-permisos/roles-permisos.component';
import { ServiciosProveedoresComponent } from './features/servicios-proveedores/servicios-proveedores.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'restablecer-password', component: RestablecerPasswordComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent, canActivate: [permisoGuard], data: { menu: 'dashboard' } },
      { path: 'clientes', component: ClientesComponent, canActivate: [permisoGuard], data: { menu: 'clientes' } },
      { path: 'tipos-servicio', component: TiposServicioComponent, canActivate: [permisoGuard], data: { menu: 'tipos_servicio' } },
      { path: 'contratos', component: ContratosComponent, canActivate: [permisoGuard], data: { menu: 'contratos' } },
      { path: 'contratos/:id', component: ContratoDetalleComponent, canActivate: [permisoGuard], data: { menu: 'contratos' } },
      { path: 'horas', component: RegistroHorasComponent, canActivate: [permisoGuard], data: { menu: 'horas' } },
      { path: 'reportes', component: ReporteHorasComponent, canActivate: [permisoGuard], data: { menu: 'reporte_horas' } },
      { path: 'reportes/servicios', component: ReporteServiciosComponent, canActivate: [permisoGuard], data: { menu: 'reporte_servicios' } },
      { path: 'usuarios', component: UsuariosComponent, canActivate: [permisoGuard], data: { menu: 'usuarios' } },
      { path: 'equipos-asignados', component: EquiposAsignadosComponent, canActivate: [permisoGuard], data: { menu: 'equipos_asignados' } },
      { path: 'servicios-proveedores', component: ServiciosProveedoresComponent, canActivate: [permisoGuard], data: { menu: 'servicios_proveedores' } },
      { path: 'auditoria-sesiones', component: AuditoriaSesionesComponent, canActivate: [permisoGuard], data: { menu: 'auditoria_sesiones' } },
      { path: 'empresas', component: EmpresasComponent, canActivate: [superAdminGuard] },
      { path: 'politica-password', component: PoliticaPasswordComponent, canActivate: [superAdminGuard] },
      { path: 'equipos', component: EquiposComponent, canActivate: [superAdminGuard] },
      { path: 'roles-permisos', component: RolesPermisosComponent, canActivate: [superAdminGuard] },
    ],
  },

  { path: '**', redirectTo: '' },
];
