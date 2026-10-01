import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RolesService } from '../../core/services/roles.service';
import { MenusAdminService } from '../../core/services/menusAdmin.service';
import { PermisosCatalogoService } from '../../core/services/permisosCatalogo.service';
import { RolMenuPermisosService } from '../../core/services/rolMenuPermisos.service';
import { MenuItem, Permiso, RolCatalogo } from '../../core/models/models';

type Pestana = 'roles' | 'menus' | 'matriz';

@Component({
  selector: 'app-roles-permisos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './roles-permisos.component.html',
  styleUrl: './roles-permisos.component.css',
})
export class RolesPermisosComponent implements OnInit {
  pestanaActiva = signal<Pestana>('roles');

  roles = signal<RolCatalogo[]>([]);
  menusPlano = signal<MenuItem[]>([]);
  permisosCatalogo = signal<Permiso[]>([]);

  // ---------- Roles ----------
  rolSeleccionado = signal<RolCatalogo | null>(null);
  formRol = this.fb.group({ codigo: ['', Validators.required], nombre: ['', Validators.required] });

  // ---------- Menus (solo nombre/icono/orden/activo -- no crea pantallas) ----------
  menuSeleccionado = signal<MenuItem | null>(null);
  formMenu = this.fb.group({ nombre: ['', Validators.required], icono: [''], orden: [0], activo: [true] });

  // ---------- Matriz ----------
  rolMatrizId = signal<number | null>(null);
  concedidos = signal<Set<string>>(new Set());
  guardandoMatriz = signal(false);

  rolMatrizActivo = computed(() => this.roles().find((r) => r.id === this.rolMatrizId()) ?? null);

  constructor(
    private fb: FormBuilder,
    private rolesSrv: RolesService,
    private menusSrv: MenusAdminService,
    private permisosSrv: PermisosCatalogoService,
    private matrizSrv: RolMenuPermisosService
  ) {}

  ngOnInit(): void {
    this.cargarRoles();
    this.cargarMenus();
    this.permisosSrv.listar().subscribe((data) => this.permisosCatalogo.set(data));
  }

  cargarRoles(): void { this.rolesSrv.listar().subscribe((data) => this.roles.set(data)); }
  cargarMenus(): void { this.menusSrv.listar().subscribe((data) => this.menusPlano.set(data)); }

  // ---------- Roles: mantenimiento ----------
  seleccionarRol(r: RolCatalogo): void {
    const yaSeleccionado = this.rolSeleccionado()?.id === r.id;
    if (yaSeleccionado) { this.nuevoRol(); return; }
    this.rolSeleccionado.set(r);
    this.formRol.reset({ codigo: r.codigo, nombre: r.nombre });
  }

  nuevoRol(): void {
    this.rolSeleccionado.set(null);
    this.formRol.reset({ codigo: '', nombre: '' });
  }

  guardarRol(): void {
    if (this.formRol.invalid) return;
    const { codigo, nombre } = this.formRol.getRawValue();
    const actual = this.rolSeleccionado();
    // El codigo queda fijo tras crear el rol (lo reusan usuarios_empresas_rol/JWT).
    const req = actual ? this.rolesSrv.actualizar(actual.id, { nombre: nombre! }) : this.rolesSrv.crear({ codigo: codigo!, nombre: nombre! });
    req.subscribe({
      next: () => { this.nuevoRol(); this.cargarRoles(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo guardar el rol'),
    });
  }

  eliminarRol(): void {
    const actual = this.rolSeleccionado();
    if (!actual) return;
    if (!confirm(`Eliminar el rol "${actual.nombre}"? Esto falla si todavia hay usuarios con ese rol asignado.`)) return;
    this.rolesSrv.eliminar(actual.id).subscribe({
      next: () => { this.nuevoRol(); this.cargarRoles(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo eliminar el rol'),
    });
  }

  // ---------- Menus: mantenimiento ----------
  seleccionarMenu(m: MenuItem): void {
    const yaSeleccionado = this.menuSeleccionado()?.id === m.id;
    if (yaSeleccionado) { this.menuSeleccionado.set(null); return; }
    this.menuSeleccionado.set(m);
    this.formMenu.reset({ nombre: m.nombre, icono: m.icono ?? '', orden: m.orden ?? 0, activo: m.activo ?? true });
  }

  guardarMenu(): void {
    const actual = this.menuSeleccionado();
    if (!actual || this.formMenu.invalid) return;
    const raw = this.formMenu.getRawValue();
    this.menusSrv.actualizar(Number(actual.id), { nombre: raw.nombre!, icono: raw.icono || undefined, orden: Number(raw.orden), activo: !!raw.activo }).subscribe({
      next: () => { this.menuSeleccionado.set(null); this.cargarMenus(); },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo guardar el menu'),
    });
  }

  // ---------- Matriz ----------
  onCambiarRolMatriz(valor: string): void {
    const rolId = Number(valor) || null;
    this.rolMatrizId.set(rolId);
    if (!rolId) { this.concedidos.set(new Set()); return; }
    this.matrizSrv.obtenerDeRol(rolId).subscribe((data) => {
      this.concedidos.set(new Set(data.map((c) => `${c.menu_id}-${c.permiso_id}`)));
    });
  }

  estaConcedido(menuId: number, permisoId: number): boolean {
    return this.concedidos().has(`${menuId}-${permisoId}`);
  }

  alternarConcesion(menuId: number, permisoId: number): void {
    const clave = `${menuId}-${permisoId}`;
    const set = new Set(this.concedidos());
    if (set.has(clave)) set.delete(clave);
    else set.add(clave);
    this.concedidos.set(set);
  }

  guardarMatriz(): void {
    const rolId = this.rolMatrizId();
    if (!rolId) return;
    const concesiones = Array.from(this.concedidos()).map((clave) => {
      const [menuId, permisoId] = clave.split('-').map(Number);
      return { menuId, permisoId };
    });
    this.guardandoMatriz.set(true);
    this.matrizSrv.guardarDeRol(rolId, concesiones).subscribe({
      next: () => { this.guardandoMatriz.set(false); alert('Matriz de permisos actualizada. Los usuarios con ese rol la veran reflejada la proxima vez que inicien sesion.'); },
      error: (err) => { this.guardandoMatriz.set(false); alert(err?.error?.mensaje || 'No se pudo guardar la matriz'); },
    });
  }
}
