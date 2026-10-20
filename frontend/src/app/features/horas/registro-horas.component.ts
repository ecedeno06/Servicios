import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AbstractControl, FormBuilder, FormsModule, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RegistroHorasService } from '../../core/services/registro-horas.service';
import { ContratosService } from '../../core/services/contratos.service';
import { AuthService } from '../../core/services/auth.service';
import { MenuService } from '../../core/services/menu.service';
import { HojaServicioPdfService } from '../../core/services/hoja-servicio-pdf.service';
import { RegistroHora, Contrato, ConsumoHoras, Comentario, ImagenServicioProveedor } from '../../core/models/models';
import { leerArchivoComoBase64 } from '../../core/utils/imagen.util';

@Component({
  selector: 'app-registro-horas',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './registro-horas.component.html',
  styleUrl: './registro-horas.component.css',
})
export class RegistroHorasComponent implements OnInit {
  registros = signal<RegistroHora[]>([]);
  contratos = signal<Contrato[]>([]);
  serviciosDisponibles = signal<ConsumoHoras[]>([]);
  panelAbierto = signal(false);
  registroEditando = signal<RegistroHora | null>(null);

  // Filtro por contrato+servicio via query params (ej. desde "Ver horas" en el detalle del contrato)
  filtroContratoId = signal<string | null>(null);
  filtroTipoServicioId = signal<string | null>(null);

  // Filtro por columna (uno por cada encabezado de la tabla)
  filtroNumero = signal('');
  filtroFecha = signal('');
  filtroCliente = signal('');
  filtroContrato = signal('');
  filtroServicio = signal('');
  filtroHoras = signal('');
  filtroUsuario = signal('');

  // Buscador general: igual que en Equipos asignados -- solo se activa
  // con el boton de la lupa (no en cada tecla), busca en cualquier dato
  // del registro (incluida la descripcion, que no tiene columna propia).
  busquedaGeneralInput = signal('');
  busquedaGeneral = signal('');

  buscarGeneral(): void {
    this.busquedaGeneral.set(this.busquedaGeneralInput());
  }

  private coincideBusquedaGeneral(r: RegistroHora, texto: string): boolean {
    const campos: (string | number | null | undefined)[] = [
      this.numeroServicio(r), fechaConHora(r), r.cliente_nombre, r.numero_contrato,
      r.tipo_servicio_nombre, r.horas, r.usuario_nombre, r.descripcion,
    ];
    return campos.some((c) => c != null && String(c).toLowerCase().includes(texto));
  }

  hayFiltros = computed(() =>
    !!(this.busquedaGeneral() ||
      this.filtroNumero() || this.filtroFecha() || this.filtroCliente() || this.filtroContrato() ||
      this.filtroServicio() || this.filtroHoras() || this.filtroUsuario())
  );

  limpiarFiltros(): void {
    this.busquedaGeneralInput.set('');
    this.busquedaGeneral.set('');
    this.filtroNumero.set('');
    this.filtroFecha.set('');
    this.filtroCliente.set('');
    this.filtroContrato.set('');
    this.filtroServicio.set('');
    this.filtroHoras.set('');
    this.filtroUsuario.set('');
  }

  registrosFiltrados = computed(() => {
    const contratoId = this.filtroContratoId();
    const tipoServicioId = this.filtroTipoServicioId();
    const fGeneral = this.busquedaGeneral().trim().toLowerCase();
    const numero = this.filtroNumero().trim().toLowerCase();
    const fecha = this.filtroFecha().trim().toLowerCase();
    const cliente = this.filtroCliente().trim().toLowerCase();
    const contrato = this.filtroContrato().trim().toLowerCase();
    const servicio = this.filtroServicio().trim().toLowerCase();
    const horas = this.filtroHoras().trim().toLowerCase();
    const usuario = this.filtroUsuario().trim().toLowerCase();

    return this.registros().filter((r) => {
      if (contratoId && r.contrato_id !== contratoId) return false;
      if (tipoServicioId && r.tipo_servicio_id !== tipoServicioId) return false;
      if (fGeneral && !this.coincideBusquedaGeneral(r, fGeneral)) return false;
      if (numero && !this.numeroServicio(r).toLowerCase().includes(numero)) return false;
      if (fecha && !fechaConHora(r).toLowerCase().includes(fecha)) return false;
      if (cliente && !(r.cliente_nombre ?? '').toLowerCase().includes(cliente)) return false;
      if (contrato && !(r.numero_contrato ?? '').toLowerCase().includes(contrato)) return false;
      if (servicio && !(r.tipo_servicio_nombre ?? '').toLowerCase().includes(servicio)) return false;
      if (horas && !String(r.horas ?? '').toLowerCase().includes(horas)) return false;
      if (usuario && !(r.usuario_nombre ?? '').toLowerCase().includes(usuario)) return false;
      return true;
    });
  });

  columnaOrden = signal<keyof RegistroHora | null>(null);
  direccionOrden = signal<'asc' | 'desc'>('asc');

  registrosOrdenados = computed(() => {
    const columna = this.columnaOrden();
    const filas = [...this.registrosFiltrados()];
    if (!columna) return filas;
    const direccion = this.direccionOrden() === 'asc' ? 1 : -1;
    return filas.sort((a, b) => {
      if (columna === 'fecha') return claveFechaHora(a).localeCompare(claveFechaHora(b)) * direccion;

      const valorA = a[columna];
      const valorB = b[columna];
      if (valorA == null && valorB == null) return 0;
      if (valorA == null) return -1 * direccion;
      if (valorB == null) return 1 * direccion;
      if (typeof valorA === 'number' && typeof valorB === 'number') return (valorA - valorB) * direccion;
      return String(valorA).localeCompare(String(valorB)) * direccion;
    });
  });

  horasCalculadas = signal(0);
  errorGuardar = signal<string | null>(null);

  registroComentando = signal<RegistroHora | null>(null);
  comentariosDelRegistro = signal<Comentario[]>([]);
  cargandoComentarios = signal(false);
  notaNueva = '';

  // Popup de solo lectura (icono "i"): ver comentarios + adjuntos sin abrir
  // el formulario de "Agregar comentario" -- senales propias para no pisar
  // el drawer de comentarios si estuviera abierto para otro registro.
  registroInfoActual = signal<RegistroHora | null>(null);
  comentariosInfoRegistro = signal<Comentario[]>([]);
  cargandoComentariosInfo = signal(false);

  // Adjuntos de un comentario (PDF/PNG/JPG en base64, max 2MB) -- se
  // guardan/borran al instante contra su propio endpoint, solo disponibles
  // una vez el comentario ya existe (igual que Servicios/Equipos).
  private readonly TIPOS_ARCHIVO_PERMITIDOS = ['image/png', 'image/jpeg', 'application/pdf'];
  private readonly MAX_ARCHIVO_BYTES = 2 * 1024 * 1024; // 2MB
  guardandoAdjuntoComentario = signal<string | null>(null); // id del comentario en subida
  errorAdjuntoComentario = signal<string | null>(null);

  form = this.fb.group(
    {
      contrato_id: ['', Validators.required],
      tipo_servicio_id: ['', Validators.required],
      fecha: [new Date().toISOString().substring(0, 10), Validators.required],
      hora_inicio: ['', Validators.required],
      hora_fin: ['', Validators.required],
      descripcion: [''],
    },
    { validators: horaFinPosteriorValidator }
  );

  constructor(
    private fb: FormBuilder,
    private srv: RegistroHorasService,
    private contratosSrv: ContratosService,
    private route: ActivatedRoute,
    private pdfSrv: HojaServicioPdfService,
    public auth: AuthService,
    public menu: MenuService
  ) {}

  ngOnInit(): void {
    this.cargar();
    // El rol cliente no tiene acceso a /contratos (no ejecuta ni registra
    // trabajo, ver PORTAL-CLIENTE.md) -- no se pide para evitar un 403.
    if (!this.auth.esCliente()) {
      this.contratosSrv.listar().subscribe((data) => this.contratos.set(data));
    }
    this.form.get('contrato_id')?.valueChanges.subscribe((contratoId) => this.alCambiarContrato(contratoId));
    this.form.valueChanges.subscribe(({ hora_inicio, hora_fin }) => {
      this.horasCalculadas.set(calcularHoras(hora_inicio, hora_fin));
    });
    this.route.queryParamMap.subscribe((params) => {
      this.filtroContratoId.set(params.get('contrato_id'));
      this.filtroTipoServicioId.set(params.get('tipo_servicio_id'));
      const registroId = params.get('registro_id');
      if (registroId) {
        this.registroIdDesdeQuery = registroId;
        this.intentarAbrirDesdeQuery();
      }
    });
  }

  // Id de registro pedido por query param (ej. desde una notificacion de
  // comentario nuevo) pendiente de abrir apenas carguen los registros.
  private registroIdDesdeQuery: string | null = null;

  private intentarAbrirDesdeQuery(): void {
    if (!this.registroIdDesdeQuery) return;
    const registro = this.registros().find((r) => r.id === this.registroIdDesdeQuery);
    if (registro) {
      this.registroIdDesdeQuery = null;
      this.abrirComentarios(registro);
    }
  }

  cargar(): void {
    this.srv.listar().subscribe((data) => {
      this.registros.set(data);
      this.intentarAbrirDesdeQuery();
    });
  }

  ordenarPor(columna: keyof RegistroHora): void {
    if (this.columnaOrden() === columna) {
      this.direccionOrden.set(this.direccionOrden() === 'asc' ? 'desc' : 'asc');
    } else {
      this.columnaOrden.set(columna);
      this.direccionOrden.set('asc');
    }
  }

  indicadorOrden(columna: keyof RegistroHora): string {
    if (this.columnaOrden() !== columna) return '';
    return this.direccionOrden() === 'asc' ? ' ▲' : ' ▼';
  }

  abrirNuevo(): void {
    this.registroEditando.set(null);
    const contratoId = this.filtroContratoId();
    const tipoServicioId = this.filtroTipoServicioId();
    this.form.reset({ fecha: new Date().toISOString().substring(0, 10), contrato_id: contratoId ?? '' });
    this.horasCalculadas.set(0);
    this.errorGuardar.set(null);

    if (contratoId) {
      this.srv.consumoPorContrato(contratoId).subscribe((data) => {
        this.serviciosDisponibles.set(data);
        if (tipoServicioId) this.form.get('tipo_servicio_id')?.setValue(tipoServicioId);
      });
    } else {
      this.serviciosDisponibles.set([]);
    }

    this.panelAbierto.set(true);
  }

  abrirEditar(r: RegistroHora): void {
    this.registroEditando.set(r);
    this.form.reset({
      contrato_id: r.contrato_id,
      tipo_servicio_id: r.tipo_servicio_id,
      fecha: r.fecha.substring(0, 10),
      hora_inicio: r.hora_inicio?.substring(0, 5) ?? '',
      hora_fin: r.hora_fin?.substring(0, 5) ?? '',
      descripcion: r.descripcion ?? '',
    });
    this.horasCalculadas.set(calcularHoras(r.hora_inicio, r.hora_fin));
    this.errorGuardar.set(null);
    this.panelAbierto.set(true);
  }

  cerrarPanel(): void { this.panelAbierto.set(false); }

  alCambiarContrato(contratoId: string | null): void {
    this.form.get('tipo_servicio_id')?.setValue('', { emitEvent: false });
    if (!contratoId) { this.serviciosDisponibles.set([]); return; }
    this.srv.consumoPorContrato(contratoId).subscribe((data) => this.serviciosDisponibles.set(data));
  }

  guardar(): void {
    if (this.form.invalid) return;
    this.errorGuardar.set(null);
    const editando = this.registroEditando();
    const { fecha, hora_inicio, hora_fin, descripcion } = this.form.getRawValue();
    const peticion = editando
      ? this.srv.actualizar(editando.id, { fecha, hora_inicio, hora_fin, descripcion })
      : this.srv.crear(this.form.getRawValue());
    peticion.subscribe({
      next: () => { this.cerrarPanel(); this.cargar(); },
      error: (err) => this.errorGuardar.set(err?.error?.mensaje || 'No se pudo guardar el registro de horas'),
    });
  }

  eliminar(r: RegistroHora): void {
    if (!confirm('Eliminar este registro de horas?')) return;
    this.srv.eliminar(r.id).subscribe(() => this.cargar());
  }

  numeroServicio(r: RegistroHora): string {
    return r.id.slice(0, 8).toUpperCase();
  }

  abrirComentarios(r: RegistroHora): void {
    this.registroComentando.set(r);
    this.notaNueva = '';
    this.comentariosDelRegistro.set([]);
    this.cargandoComentarios.set(true);
    this.srv.listarComentarios(r.id).subscribe({
      next: (data) => {
        this.comentariosDelRegistro.set(data);
        this.cargandoComentarios.set(false);
      },
      error: () => this.cargandoComentarios.set(false),
    });
    // Se marca como visto al abrir -- no afecta el contador de este boton
    // (ese es el total, no el de no-leidos), solo la campanita del header.
    this.srv.marcarComentariosVistos(r.id).subscribe();
  }

  cerrarComentarios(): void {
    this.registroComentando.set(null);
    this.errorAdjuntoComentario.set(null);
  }

  abrirModalInfoComentarios(event: MouseEvent, r: RegistroHora): void {
    event.stopPropagation();
    this.registroInfoActual.set(r);
    this.comentariosInfoRegistro.set([]);
    this.cargandoComentariosInfo.set(true);
    this.srv.listarComentarios(r.id).subscribe({
      next: (data) => {
        this.comentariosInfoRegistro.set(data);
        this.cargandoComentariosInfo.set(false);
      },
      error: () => this.cargandoComentariosInfo.set(false),
    });
  }

  cerrarModalInfoComentarios(): void {
    this.registroInfoActual.set(null);
    this.comentariosInfoRegistro.set([]);
  }

  comentariosOrdenados(): Comentario[] {
    return [...this.comentariosDelRegistro()].reverse();
  }

  agregarComentario(): void {
    const registro = this.registroComentando();
    const nota = this.notaNueva.trim();
    if (!registro || !nota) return;
    this.srv.agregarComentario(registro.id, nota).subscribe({
      next: (comentario) => {
        this.comentariosDelRegistro.update((lista) => [...lista, comentario]);
        this.notaNueva = '';
        // Refleja el nuevo total en el boton de la fila sin recargar todo.
        this.registros.update((lista) =>
          lista.map((r) => (r.id === registro.id ? { ...r, comentarios_count: (r.comentarios_count ?? 0) + 1 } : r))
        );
      },
      error: (err) => alert(err?.error?.mensaje || 'No se pudo agregar el comentario'),
    });
  }

  onSeleccionArchivoComentario(event: Event, comentarioId: string): void {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (archivo) this.procesarArchivoComentario(archivo, comentarioId);
    input.value = '';
  }

  onPasteImagenComentario(event: ClipboardEvent, comentarioId: string): void {
    this.errorAdjuntoComentario.set(null);
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const archivo = items[i].getAsFile();
        if (archivo) this.procesarArchivoComentario(archivo, comentarioId);
        return;
      }
    }
    this.errorAdjuntoComentario.set('No se encontró ninguna imagen en el portapapeles.');
  }

  private procesarArchivoComentario(archivo: File, comentarioId: string): void {
    this.errorAdjuntoComentario.set(null);
    const registro = this.registroComentando();
    if (!registro) return;

    if (!this.TIPOS_ARCHIVO_PERMITIDOS.includes(archivo.type)) {
      this.errorAdjuntoComentario.set('Solo se permiten archivos PDF, PNG o JPG.');
      return;
    }
    if (archivo.size > this.MAX_ARCHIVO_BYTES) {
      this.errorAdjuntoComentario.set('El archivo supera el tamaño máximo permitido (2MB).');
      return;
    }

    this.guardandoAdjuntoComentario.set(comentarioId);
    leerArchivoComoBase64(archivo).then((base64) => {
      this.srv.crearAdjuntoComentario(registro.id, comentarioId, { imagen_base64: base64 }).subscribe({
        next: (nuevo) => {
          this.guardandoAdjuntoComentario.set(null);
          this.comentariosDelRegistro.update((lista) =>
            lista.map((c) => (c.id === comentarioId ? { ...c, adjuntos: [nuevo, ...(c.adjuntos ?? [])] } : c))
          );
        },
        error: (err) => {
          this.guardandoAdjuntoComentario.set(null);
          this.errorAdjuntoComentario.set(err.error?.mensaje || 'No se pudo guardar el adjunto.');
        },
      });
    }).catch(() => {
      this.guardandoAdjuntoComentario.set(null);
      this.errorAdjuntoComentario.set('No se pudo leer el archivo.');
    });
  }

  eliminarAdjuntoComentario(comentarioId: string, adjuntoId: string): void {
    const registro = this.registroComentando();
    if (!registro) return;
    if (!confirm('¿Eliminar este adjunto?')) return;
    this.srv.eliminarAdjuntoComentario(registro.id, comentarioId, adjuntoId).subscribe({
      next: () => this.comentariosDelRegistro.update((lista) =>
        lista.map((c) => (c.id === comentarioId ? { ...c, adjuntos: (c.adjuntos ?? []).filter((a) => a.id !== adjuntoId) } : c))
      ),
      error: (err) => alert(err.error?.mensaje || 'No se pudo eliminar el adjunto'),
    });
  }

  // El listado de comentarios solo trae el encabezado recortado del base64
  // (ver backend#listarComentarios), asi que el contenido completo se pide
  // recien al abrirlo -- evita traer de una vez el peso de todos los
  // archivos de todos los comentarios cada vez que se abre un drawer/popup.
  private abrirAdjuntoLazy(registroId: string, comentarioId: string, adjuntoId: string): void {
    this.srv.obtenerAdjuntoComentario(registroId, comentarioId, adjuntoId).subscribe({
      next: (completo) => this.abrirBase64(completo.imagen_base64),
      error: (err) => alert(err.error?.mensaje || 'No se pudo abrir el adjunto.'),
    });
  }

  abrirAdjuntoComentario(comentarioId: string, adjuntoId: string): void {
    const registro = this.registroComentando();
    if (!registro) return;
    this.abrirAdjuntoLazy(registro.id, comentarioId, adjuntoId);
  }

  abrirAdjuntoInfo(comentarioId: string, adjuntoId: string): void {
    const registro = this.registroInfoActual();
    if (!registro) return;
    this.abrirAdjuntoLazy(registro.id, comentarioId, adjuntoId);
  }

  // Un <a href="data:..."> no alcanza (Chrome/Edge bloquean la navegacion a
  // un data: URI), asi que se convierte a Blob primero -- mismo patron que
  // Equipos Asignados/Servicios y Proveedores.
  private abrirBase64(base64: string): void {
    const [meta, datos] = base64.split(',');
    const tipo = meta.match(/data:(.*);base64/)?.[1] || 'application/octet-stream';
    const binario = atob(datos);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  tipoArchivoLabel(base64: string): string {
    if (base64.startsWith('data:application/pdf')) return 'PDF';
    if (base64.startsWith('data:image/png')) return 'PNG';
    if (base64.startsWith('data:image/jpeg')) return 'JPG';
    return 'Archivo';
  }

  // El backend ya manda tamano_bytes calculado (solo tiene el encabezado
  // recortado del base64, no el contenido completo para medirlo aca).
  tamanoAdjunto(img: ImagenServicioProveedor): string {
    return this.formatearBytes(img.tamano_bytes ?? 0);
  }

  private formatearBytes(bytes: number): string {
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  generarPdf(r: RegistroHora): void {
    // La ventana se abre YA, sincronicamente dentro del click, para que el
    // navegador no la bloquee -- pdfmake se carga de forma diferida
    // (import() dinamico) y para cuando el PDF esta listo ya no estamos
    // dentro del gesto de click original.
    const ventana = window.open('', '_blank') ?? undefined;
    const empresa = this.auth.empresaActiva();
    this.pdfSrv.generar({
      empresaNombre: empresa?.empresa_nombre ?? '',
      empresaLogo: empresa?.empresa_logo ?? null,
      numeroServicio: this.numeroServicio(r),
      fechaEmision: formatearFecha(new Date().toISOString()),
      cliente: r.cliente_nombre ?? '',
      numeroContrato: r.numero_contrato ?? '',
      direccion: '',
      ordenTrabajo: '',
      tecnico: r.usuario_nombre ?? '',
      supervisor: '',
      tipoServicio: r.tipo_servicio_nombre ?? '',
      prioridad: '',
      detalle: [{
        fecha: formatearFecha(r.fecha),
        horaInicio: r.hora_inicio?.substring(0, 5) ?? '',
        horaFin: r.hora_fin?.substring(0, 5) ?? '',
        descripcion: r.descripcion ?? '',
      }],
      observaciones: '',
    }).then((doc) => doc.open(undefined, ventana))
      .catch(() => alert('No se pudo generar la hoja de servicio.'));
  }
}

function formatearFecha(iso: string | null | undefined): string {
  if (!iso) return '';
  const [anio, mes, dia] = iso.substring(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

function claveFechaHora(r: RegistroHora): string {
  const fecha = r.fecha?.substring(0, 10) ?? '';
  const hora = r.created_at?.substring(11, 19) ?? '00:00:00';
  return `${fecha}T${hora}`;
}

// Misma cadena que se muestra en la columna Fecha de la tabla, para que el
// filtro de esa columna busque sobre lo que el usuario realmente ve.
function fechaConHora(r: RegistroHora): string {
  const fecha = formatearFecha(r.fecha);
  const hora = r.created_at ? r.created_at.substring(11, 16) : '';
  return hora ? `${fecha} ${hora}` : fecha;
}

function calcularHoras(horaInicio: string | null | undefined, horaFin: string | null | undefined): number {
  if (!horaInicio || !horaFin) return 0;
  const [h1, m1] = horaInicio.split(':').map(Number);
  const [h2, m2] = horaFin.split(':').map(Number);
  const minutos = (h2 * 60 + m2) - (h1 * 60 + m1);
  return minutos > 0 ? Math.round((minutos / 60) * 100) / 100 : 0;
}

function horaFinPosteriorValidator(group: AbstractControl): ValidationErrors | null {
  const inicio = group.get('hora_inicio')?.value;
  const fin = group.get('hora_fin')?.value;
  if (!inicio || !fin) return null;
  return calcularHoras(inicio, fin) <= 0 ? { horaFinInvalida: true } : null;
}
