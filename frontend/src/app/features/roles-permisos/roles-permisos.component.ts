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

  // ---------- Menus (ver nota de alcance mas abajo en guardarMenu/nuevoMenu) ----------
  menuSeleccionado = signal<MenuItem | null>(null);
  creandoMenu = signal(false);
  formMenu = this.fb.group({
    codigo: ['', Validators.required],
    nombre: ['', Validators.required],
    ruta: [''],
    icono: [''],
    padre_id: [''],
    orden: [0],
    activo: [true],
  });

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
  // "codigo" es lo que requirePermiso('<codigo>', ...) usa en el backend y
  // los route guards en el frontend -- queda fijo tras crear el menu, igual
  // que el codigo de un rol. "ruta" tiene que apuntar a un componente
  // Angular que YA existe: crear/editar un menu aqui no crea una pantalla
  // nueva, y si se crea un menu para una ruta que todavia no existe en el
  // codigo, el link del sidebar no va a llevar a ningun lado. Ademas, para
  // que el backend realmente exija el permiso (no solo que se vea u oculte
  // el link), un desarrollador tiene que llamar a requirePermiso('<codigo>',
  // accion) en el router correspondiente -- esta pantalla sola no alcanza
  // para proteger una ruta nueva del lado del servidor.
  seleccionarMenu(m: MenuItem): void {
    const yaSeleccionado = this.menuSeleccionado()?.id === m.id;
    if (yaSeleccionado) { this.cancelarMenu(); return; }
    this.creandoMenu.set(false);
    this.menuSeleccionado.set(m);
    this.formMenu.reset({
      codigo: m.codigo, nombre: m.nombre, ruta: m.ruta ?? '', icono: m.icono ?? '',
      padre_id: m.padre_id != null ? String(m.padre_id) : '', orden: m.orden ?? 0, activo: m.activo ?? true,
    });
    this.formMenu.get('codigo')?.disable();
  }

  nuevoMenu(): void {
    this.menuSeleccionado.set(null);
    this.creandoMenu.set(true);
    this.formMenu.reset({ codigo: '', nombre: '', ruta: '', icono: '', padre_id: '', orden: 0, activo: true });
    this.formMenu.get('codigo')?.enable();
  }

  cancelarMenu(): void {
    this.menuSeleccionado.set(null);
    this.creandoMenu.set(false);
  }

  guardarMenu(): void {
    if (this.formMenu.invalid) return;
    const raw = this.formMenu.getRawValue();
    const actual = this.menuSeleccionado();
    const padreId = raw.padre_id ? Number(raw.padre_id) : null;
    const req = actual
      ? this.menusSrv.actualizar(Number(actual.id), {
          nombre: raw.nombre!, ruta: raw.ruta?.trim() || undefined, icono: raw.icono || undefined,
          padre_id: padreId, orden: Number(raw.orden), activo: !!raw.activo,
        })
      : this.menusSrv.crear({
          codigo: raw.codigo!, nombre: raw.nombre!, ruta: raw.ruta?.trim() || undefined, icono: raw.icono || undefined,
          padre_id: padreId ?? undefined, orden: Number(raw.orden),
        });
    req.subscribe({
      next: () => { this.cancelarMenu(); this.cargarMenus(); },
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
