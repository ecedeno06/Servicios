import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { LayoutComponent } from './features/layout/layout.component';
import { LoginComponent } from './features/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ClientesComponent } from './features/clientes/clientes.component';
import { TiposServicioComponent } from './features/tipos-servicio/tipos-servicio.component';
import { ContratosComponent } from './features/contratos/contratos.component';
import { ContratoDetalleComponent } from './features/contratos/contrato-detalle.component';
import { RegistroHorasComponent } from './features/horas/registro-horas.component';
import { UsuariosComponent } from './features/usuarios/usuarios.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'clientes', component: ClientesComponent },
      { path: 'tipos-servicio', component: TiposServicioComponent },
      { path: 'contratos', component: ContratosComponent },
      { path: 'contratos/:id', component: ContratoDetalleComponent },
      { path: 'horas', component: RegistroHorasComponent },
      { path: 'usuarios', component: UsuariosComponent },
    ],
  },
  { path: '**', redirectTo: '' },
];
