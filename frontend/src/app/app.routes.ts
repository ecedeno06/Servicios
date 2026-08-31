import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { superAdminGuard } from './core/guards/super-admin.guard';
import { noClienteGuard } from './core/guards/no-cliente.guard';
import { LayoutComponent } from './features/layout/layout.component';
import { LoginComponent } from './features/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ClientesComponent } from './features/clientes/clientes.component';
import { TiposServicioComponent } from './features/tipos-servicio/tipos-servicio.component';
import { ContratosComponent } from './features/contratos/contratos.component';
import { ContratoDetalleComponent } from './features/contratos/contrato-detalle.component';
import { RegistroHorasComponent } from './features/horas/registro-horas.component';
import { ReporteHorasComponent } from './features/reportes/reporte-horas.component';
import { UsuariosComponent } from './features/usuarios/usuarios.component';
import { EmpresasComponent } from './features/empresas/empresas.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'clientes', component: ClientesComponent, canActivate: [noClienteGuard] },
      { path: 'tipos-servicio', component: TiposServicioComponent, canActivate: [noClienteGuard] },
      { path: 'contratos', component: ContratosComponent, canActivate: [noClienteGuard] },
      { path: 'contratos/:id', component: ContratoDetalleComponent, canActivate: [noClienteGuard] },
      { path: 'horas', component: RegistroHorasComponent },
      { path: 'reportes', component: ReporteHorasComponent, canActivate: [noClienteGuard] },
      { path: 'usuarios', component: UsuariosComponent, canActivate: [noClienteGuard] },
      { path: 'empresas', component: EmpresasComponent, canActivate: [superAdminGuard] },
    ],
  },
  { path: '**', redirectTo: '' },
];
