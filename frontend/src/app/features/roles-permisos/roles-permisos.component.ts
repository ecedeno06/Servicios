import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { RolesService } from '../../core/services/roles.service';
import { MenusAdminService } from '../../core/services/menusAdmin.service';
import { PermisosCatalogoService } from '../../core/services/permisosCatalogo.service';
import { RolMenuPermisosService } from '../../core/services/rolMenuPermisos.service';
import { MenuItem, Permiso, RolCatalogo } from '../../core/models/models';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmPasswordService } from '../../core/services/confirm-password.service';

type Pestana = 'roles' | 'menus';
type FilaMatriz = { tipo: 'categoria'; menu: MenuItem } | { tipo: 'item'; menu: MenuItem; indentado: boolean };

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
  filtroMenuTexto = signal('');
  formMenu = this.fb.group({
    codigo: ['', Validators.required],
    nombre: ['', Validators.required],
    ruta: [''],
    icono: [''],
    padre_id: [''],
    orden: [0],
    activo: [true],
  });

  menusOrdenados = computed(() => [...this.menusPlano()].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)));
  menusFiltrados = computed(() => {
    const texto = this.filtroMenuTexto().trim().toLowerCase();
    const lista = this.menusOrdenados();
    if (!texto) return lista;
    return lista.filter((m) => [m.codigo, m.nombre, m.ruta].some((v) => (v ?? '').toLowerCase().includes(texto)));
  });

  // ---------- Matriz (se carga/edita para el rol seleccionado a la izquierda) ----------
  concedidos = signal<Set<string>>(new Set());
  // Foto de lo que ya estaba concedido al cargar el rol -- para poder armar
  // un detalle de que cambio exactamente al guardar (ver guardarMatriz()),
  // y para saber si hay cambios sin guardar (ver matrizSucia/cambiosPendientes).
  concedidosOriginal = signal<Set<string>>(new Set());
  guardandoMatriz = signal(false);

  // Arma las filas de la matriz respetando el arbol real (padre_id): un menu
  // sin ruta propia que tiene hijos (hoy solo "Reportes") es un encabezado de
  // categoria sin checkboxes propios -- nunca se le exige permiso en el
  // backend, asi que asignarselo no haria nada.
  filasMatriz = computed<FilaMatriz[]>(() => {
    const todos = this.menusPlano();
    const raices = todos.filter((m) => !m.padre_id).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    const filas: FilaMatriz[] = [];
    for (const raiz of raices) {
      const hijos = todos.filter((m) => Number(m.padre_id) === Number(raiz.id)).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
      if (hijos.length) {
        filas.push({ tipo: 'categoria', menu: raiz });
        for (const h of hijos) filas.push({ tipo: 'item', menu: h, indentado: true });
      } else {
        filas.push({ tipo: 'item', menu: raiz, indentado: false });
      }
    }
    return filas;
  });

  totalModulosMatriz = computed(() => this.filasMatriz().filter((f) => f.tipo === 'item').length);
  modulosConAcceso = computed(() => new Set([...this.concedidos()].map((c) => c.split('-')[0])).size);

  cambiosPendientes = computed(() => {
    const antes = this.concedidosOriginal();
    const despues = this.concedidos();
    let n = 0;
    for (const c of despues) if (!antes.has(c)) n++;
    for (const c of antes) if (!despues.has(c)) n++;
    return n;
  });
  matrizSucia = computed(() => this.cambiosPendientes() > 0);

  constructor(
    private fb: FormBuilder,
    private rolesSrv: RolesService,
    private menusSrv: MenusAdminService,
    private permisosSrv: PermisosCatalogoService,
    private matrizSrv: RolMenuPermisosService,
    private toast: ToastService,
    private confirmPasswordSrv: ConfirmPasswordService
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
    this.cargarMatrizDeRol(r.id);
  }

  nuevoRol(): void {
    this.rolSeleccionado.set(null);
    this.formRol.reset({ codigo: '', nombre: '' });
    this.concedidos.set(new Set());
    this.concedidosOriginal.set(new Set());
  }

  guardarRol(): void {
    if (this.formRol.invalid) return;
    const { codigo, nombre } = this.formRol.getRawValue();
    const actual = this.rolSeleccionado();
    // El codigo queda fijo tras crear el rol (lo reusan usuarios_empresas_rol/JWT).
    const req = actual ? this.rolesSrv.actualizar(actual.id, { nombre: nombre! }) : this.rolesSrv.crear({ codigo: codigo!, nombre: nombre! });
    req.subscribe({
      next: (rolGuardado) => {
        this.cargarRoles();
        if (actual) {
          this.rolSeleccionado.set(rolGuardado);
          this.formRol.reset({ codigo: rolGuardado.codigo, nombre: rolGuardado.nombre });
        } else {
          this.nuevoRol();
        }
      },
      error: (err) => this.toast.error(err?.error?.mensaje || 'No se pudo guardar el rol'),
    });
  }

  async eliminarRol(): Promise<void> {
    const actual = this.rolSeleccionado();
    if (!actual) return;
    const ok = await this.confirmPasswordSrv.confirmar(
      `Eliminar el rol "${actual.nombre}"? Esto falla si todavia hay usuarios con ese rol asignado.`,
      (password) => this.rolesSrv.eliminar(actual.id, password)
    );
    if (!ok) return;

    this.toast.exito(`Rol "${actual.nombre}" eliminado correctamente.`);
    this.nuevoRol();
    this.cargarRoles();
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
      error: (err) => this.toast.error(err?.error?.mensaje || 'No se pudo guardar el menu'),
    });
  }

  esPrimeroEnOrden(m: MenuItem): boolean {
    const lista = this.menusOrdenados();
    return lista.length > 0 && lista[0].id === m.id;
  }

  esUltimoEnOrden(m: MenuItem): boolean {
    const lista = this.menusOrdenados();
    return lista.length > 0 && lista[lista.length - 1].id === m.id;
  }

  // Sube/baja un menu intercambiando su "orden" con el del vecino en ese
  // sentido (dentro de la lista ya ordenada) -- dos PUT, uno por cada lado
  // del intercambio. El backend no hace coalesce de "ruta"/"padre_id" (ver
  // menus.controller.js), asi que hay que reenviar esos campos tal cual
  // estan hoy o el update los pisaria con null.
  moverMenu(m: MenuItem, direccion: -1 | 1): void {
    const lista = this.menusOrdenados();
    const idx = lista.findIndex((x) => x.id === m.id);
    const vecino = lista[idx + direccion];
    if (!vecino) return;

    const payload = (item: MenuItem, nuevoOrden: number) => ({
      nombre: item.nombre,
      ruta: item.ruta ?? undefined,
      icono: item.icono ?? undefined,
      padre_id: item.padre_id ?? null,
      orden: nuevoOrden,
      activo: item.activo ?? true,
    });

    forkJoin([
      this.menusSrv.actualizar(Number(m.id), payload(m, vecino.orden ?? 0)),
      this.menusSrv.actualizar(Number(vecino.id), payload(vecino, m.orden ?? 0)),
    ]).subscribe({
      next: () => this.cargarMenus(),
      error: (err) => this.toast.error(err?.error?.mensaje || 'No se pudo reordenar'),
    });
  }

  // ---------- Matriz ----------
  cargarMatrizDeRol(rolId: number): void {
    this.matrizSrv.obtenerDeRol(rolId).subscribe((data) => {
      const set = new Set(data.map((c) => `${c.menu_id}-${c.permiso_id}`));
      this.concedidos.set(set);
      this.concedidosOriginal.set(new Set(set));
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

  // Marca el permiso "Ver" en todas las pantallas (atajo habitual al armar
  // un rol nuevo desde cero: casi siempre se quiere que vea todo antes de
  // afinar que puede crear/editar/eliminar).
  marcarTodosVer(): void {
    const verId = this.permisosCatalogo().find((p) => p.codigo === 'ver')?.id;
    if (!verId) return;
    const set = new Set(this.concedidos());
    for (const fila of this.filasMatriz()) {
      if (fila.tipo === 'item') set.add(`${fila.menu.id}-${verId}`);
    }
    this.concedidos.set(set);
  }

  descartarCambiosMatriz(): void {
    this.concedidos.set(new Set(this.concedidosOriginal()));
  }

  // Arma "Menu (permiso), Menu (permiso)" a partir de claves "menuId-permisoId",
  // resolviendo los nombres contra los catalogos ya cargados para la tabla.
  private describirClaves(claves: string[]): string {
    return claves
      .map((clave) => {
        const [menuId, permisoId] = clave.split('-').map(Number);
        const menu = this.menusPlano().find((m) => Number(m.id) === menuId);
        const permiso = this.permisosCatalogo().find((p) => p.id === permisoId);
        return `${menu?.nombre ?? 'Menu'} (${permiso?.nombre ?? 'permiso'})`;
      })
      .join(', ');
  }

  private describirCambiosMatriz(): string {
    const antes = this.concedidosOriginal();
    const despues = this.concedidos();
    const otorgados = [...despues].filter((c) => !antes.has(c));
    const revocados = [...antes].filter((c) => !despues.has(c));

    if (!otorgados.length && !revocados.length) return 'Sin cambios en los permisos.';

    const partes: string[] = [];
    if (otorgados.length) partes.push(`Otorgado: ${this.describirClaves(otorgados)}`);
    if (revocados.length) partes.push(`Revocado: ${this.describirClaves(revocados)}`);
    return partes.join('. ') + '.';
  }

  guardarMatriz(): void {
    const rol = this.rolSeleccionado();
    if (!rol) return;
    const concesiones = Array.from(this.concedidos()).map((clave) => {
      const [menuId, permisoId] = clave.split('-').map(Number);
      return { menuId, permisoId };
    });
    const rolNombre = rol.nombre;
    const detalle = this.describirCambiosMatriz();
    this.guardandoMatriz.set(true);
    this.matrizSrv.guardarDeRol(rol.id, concesiones).subscribe({
      next: () => {
        this.guardandoMatriz.set(false);
        this.concedidosOriginal.set(new Set(this.concedidos()));
        this.toast.exito(`Matriz de permisos de "${rolNombre}" actualizada. ${detalle} Los usuarios con ese rol la veran reflejada la proxima vez que inicien sesion.`);
      },
      error: (err) => { this.guardandoMatriz.set(false); this.toast.error(err?.error?.mensaje || 'No se pudo guardar la matriz'); },
    });
  }
}
