// Los roles son dinamicos (un super-admin puede crear roles nuevos desde
// Configuracion -> Roles y permisos) -- el codigo ya no es un enum fijo,
// aunque 'admin'/'supervisor'/'tecnico'/'cliente' siguen siendo los 4
// roles "de sistema" sembrados de entrada.
export type Rol = string;

export interface RolCatalogo {
  id: number;
  codigo: string;
  nombre: string;
  es_sistema: boolean;
  activo: boolean;
  created_at?: string;
}

export interface Permiso {
  id: number;
  codigo: string;
  nombre: string;
}

export interface MenuItem {
  id: number | string;
  codigo: string;
  nombre: string;
  ruta: string | null;
  icono: string | null;
  padre_id?: number | null;
  orden?: number;
  activo?: boolean;
  hijos: MenuItem[];
}

// { [menuCodigo]: ['ver','crear',...] }
export type MapaPermisos = Record<string, string[]>;

export interface ConcesionMatriz {
  menu_id: number;
  permiso_id: number;
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  // Rol y activo son atributos de la relacion con la empresa activa
  // (usuarios_empresas_rol), no de la persona en si.
  rol: Rol | null;
  activo: boolean;
  avatar?: string | null;
  es_super_admin?: boolean;
  empresa_id?: string | null;
  empresa_nombre?: string | null;
  empresa_logo?: string | null;
  cliente_id?: string | null;
  cliente_nombre?: string | null;
  debe_cambiar_password?: boolean;
  two_factor_enabled?: boolean;
  created_at?: string;
}

export interface PoliticaPassword {
  id?: number;
  longitud_minima: number;
  mayuscula_minima: number;
  minuscula_minima: number;
  requiere_numero: boolean;
  requiere_caracter_especial: boolean;
  caracteres_numericos: string;
  caracteres_especiales: string;
  pista_longitud_minima: number;
  pista_similitud_maxima_porcentaje: number;
  updated_at?: string;
}

export type MotivoSalida =
  | 'logout_usuario'
  | 'inactividad'
  | 'token_invalido'
  | 'expiracion_token'
  | 'expiracion_automatica'
  | 'cerrada_por_admin'
  | 'expirada_sin_cerrar'
  | 'en_curso';

export interface SesionAuditoria {
  id: string;
  usuario_id: string;
  usuario_nombre: string;
  usuario_email: string;
  rol: string | null;
  empresa_nombre: string | null;
  ip_address: string | null;
  geo_pais: string | null;
  geo_region: string | null;
  geo_ciudad: string | null;
  geo_lat: number | null;
  geo_lon: number | null;
  es_sesion_actual: boolean;
  login_en: string;
  logout_en: string | null;
  duracion_segundos: number | null;
  motivo_salida: MotivoSalida;
  activo: boolean;
}

export type NivelLog = 'error' | 'advertencia';

export interface LogError {
  id: string;
  nivel: NivelLog;
  mensaje: string;
  stack: string | null;
  codigo: string | null;
  metodo_http: string | null;
  ruta: string | null;
  status_http: number | null;
  empresa_id: string | null;
  empresa_nombre: string | null;
  usuario_id: string | null;
  usuario_nombre: string | null;
  usuario_email: string | null;
  ip_address: string | null;
  body: Record<string, unknown> | null;
  created_at: string;
}

// Catalogo global de equipos (no depende de empresa_id) -- ids numericos
// (serial), a diferencia del resto del sistema que usa uuid.
export interface Categoria {
  id: number;
  nombre: string;
}

export interface Producto {
  id: number;
  categoria_id: number;
  nombre: string;
  categoria_nombre?: string;
  aplica_checklist?: boolean;
  observacion?: string | null;
  url?: string | null;
}

export interface Procesador {
  id: number;
  nombre: string;
}

export type EstadoEquipo = 'en_uso' | 'stock' | 'reparacion' | 'dano' | 'descarte' | 'vendida';

// Tabla intermedia entre el catalogo global (categorias/productos) y una
// empresa: cada unidad fisica de equipo que la empresa tiene.
export interface EquipoAsignado {
  id: string;
  empresa_id: string;
  producto_id: number;
  producto_nombre: string;
  producto_aplica_checklist?: boolean;
  producto_url?: string | null;
  categoria_nombre: string;
  marca: string;
  modelo: string;
  fecha_entrada: string;
  vida_util_meses: number | null;
  estado: EstadoEquipo;
  asignada_a: string | null;
  observacion: string | null;
  // Especificaciones tecnicas, todas opcionales.
  procesador_id: number | null;
  procesador_nombre: string | null;
  memoria_ram: string | null;
  disco_duro: string | null;
  numero_serie: string | null;
  numero_puertos: number | null;
  numero_puertos_hdmi: number | null;
  mac_address: string | null;
  ip_fija: string | null;
  hardware_address: string | null;
  precio_usd: number | null;
  locacion_pais: string | null;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  no_factura: string | null;
  url: string | null;
  creado_por: string;
  creado_por_nombre: string;
  modificado_por: string | null;
  modificado_por_nombre: string | null;
  created_at: string;
  updated_at: string;
}

// Un movimiento del historico de un equipo (cambio de estado). Se genera
// solo, desde el backend, al crear el equipo (estado_anterior = null) y
// cada vez que el estado cambia al editarlo.
export interface MovimientoEquipo {
  id: string;
  equipo_asignado_id: string;
  estado_anterior: EstadoEquipo | null;
  estado_nuevo: EstadoEquipo;
  asignada_a_anterior: string | null;
  asignada_a: string | null;
  observacion: string | null;
  checklist?: { id: string; descripcion: string }[] | null;
  registrado_por: string;
  registrado_por_nombre: string;
  fecha_cambio: string;
}

export interface UsuarioForm {
  nombre?: string;
  email: string;
  password?: string;
  rol: Rol;
  activo: boolean;
}

export interface Empresa {
  id: string;
  nombre: string;
  identificacion?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  logo?: string | null;
  activo: boolean;
  created_at?: string;
}

// Empresa a la que pertenece el usuario autenticado, con su rol en ella
// (para el selector de empresa activa y el picker de login multi-empresa)
export interface EmpresaSeleccionable {
  empresa_id: string;
  empresa_nombre: string;
  rol: Rol;
}

// Catalogo global de usuarios (id, nombre, email), sin rol -- para elegir
// a quien asociar a una empresa desde la pantalla de Empresas
export interface UsuarioGlobal {
  id: string;
  nombre: string;
  email: string;
}

// Usuario asociado a una empresa puntual, visto desde la pantalla de Empresas
export interface UsuarioDeEmpresa extends UsuarioGlobal {
  rol: Rol;
  cliente_id?: string | null;
  cliente_nombre?: string | null;
}

export interface Cliente {
  id: string;
  empresa_id?: string;
  nombre: string;
  identificacion?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  activo: boolean;
  created_at?: string;
}

export interface TipoServicio {
  id: string;
  empresa_id?: string;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  created_at?: string;
}

export type EstadoContrato = 'activo' | 'vencido' | 'cancelado' | 'finalizado';

export interface Documento {
  nombre: string;
  url: string;
}

export interface Contrato {
  id: string;
  empresa_id?: string;
  cliente_id: string;
  cliente_nombre?: string;
  numero_contrato: string;
  fecha_inicio: string;
  fecha_fin?: string | null;
  estado: EstadoContrato;
  observaciones?: string;
  documentos?: Documento[];
  created_at?: string;
  servicios?: ConsumoHoras[];
}

export interface Contacto {
  nombre?: string;
  correo?: string;
  telefono?: string;
}

export interface ContratoServicio {
  id: string;
  contrato_id: string;
  tipo_servicio_id: string;
  horas_contratadas: number;
  contactos?: Contacto[] | null;
}

export interface ConsumoHoras {
  contrato_servicio_id: string;
  contrato_id: string;
  numero_contrato: string;
  estado_contrato: EstadoContrato;
  cliente_id: string;
  cliente_nombre: string;
  tipo_servicio_id: string;
  tipo_servicio_nombre: string;
  horas_contratadas: number;
  contactos?: Contacto[] | null;
  horas_ejecutadas: number;
  horas_disponibles: number;
}

export interface Comentario {
  id?: string;
  fecha: string;
  usuario_id: string;
  usuario_nombre: string;
  nota: string;
  adjuntos?: ImagenServicioProveedor[];
}

export interface NotificacionComentario {
  registro_horas_id: string;
  numero_contrato: string;
  cliente_nombre: string;
  comentarios_nuevos: Comentario[];
}

export interface RegistroHora {
  id: string;
  empresa_id?: string;
  contrato_id: string;
  numero_contrato?: string;
  cliente_nombre?: string;
  tipo_servicio_id: string;
  tipo_servicio_nombre?: string;
  usuario_id: string;
  usuario_nombre?: string;
  fecha: string;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  horas: number;
  descripcion?: string;
  comentarios_count?: number;
  created_at?: string;
}

export type SectorProveedor = string;

export interface SectorProveedorItem {
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
  creado_por: string;
  creado_por_nombre?: string;
  modificado_por?: string | null;
  modificado_por_nombre?: string | null;
  created_at: string;
  updated_at: string;
  proveedores_count?: number;
}

export interface Proveedor {
  id: string;
  empresa_id: string;
  nombre: string;
  descripcion?: string | null;
  contactos: ContactoProveedorPrincipal[];
  sector: string;
  sector_id?: string | null;
  sector_nombre?: string | null;
  url?: string | null;
  creado_por: string;
  creado_por_nombre?: string;
  modificado_por?: string | null;
  modificado_por_nombre?: string | null;
  created_at: string;
  updated_at: string;
  servicios_count?: number;
}

// Contacto del CATALOGO de proveedores (puede haber mas de uno) -- nombres
// de campo pedidos explicitamente (correo/codigo_pais), distintos de
// ContactoProveedor (email/telefono_codigo_pais) que es para los
// contactos propios de un SERVICIO, no del proveedor.
export interface ContactoProveedorPrincipal {
  nombre?: string;
  correo?: string;
  codigo_pais?: string;
  telefono?: string;
  cargo?: string;
}

export interface ContactoProveedor {
  nombre: string;
  telefono?: string;
  telefono_codigo_pais?: string;
  email?: string;
  cargo?: string;
}

// Adjunto (PDF/PNG/JPG en base64) de un servicio contratado. fecha y
// creado_por se fijan al subir el archivo, no son editables en la UI.
export interface ImagenServicioProveedor {
  id: string;
  fecha: string;
  descripcion?: string | null;
  imagen_base64: string;
  // Presente cuando el backend manda el encabezado recortado en vez del
  // contenido completo (ver Comentario.adjuntos en Registro de horas).
  tamano_bytes?: number;
  creado_por: string;
  creado_por_nombre?: string;
  created_at: string;
}

// Catalogo con CRUD (Configuracion > Estados de Servicio) -- reemplaza la
// lista fija que antes vivia en el frontend. 'estado' en ServicioProveedor
// sigue siendo texto (sincronizado con el nombre de este catalogo al
// guardar/renombrar) para no romper filtros/ordenamiento existentes.
export interface EstadoServicioProveedorItem {
  id: string;
  empresa_id: string;
  nombre: string;
  clase_badge: string;
  activo: boolean;
  creado_por: string;
  creado_por_nombre?: string;
  modificado_por?: string | null;
  modificado_por_nombre?: string | null;
  created_at: string;
  updated_at: string;
  servicios_count?: number;
}

// Catalogo con CRUD (Configuracion > Checklist) -- tabla de parametros
// generica (descripcion + observacion), consumida por Equipos Asignados
// (ver EquipoChecklistItem) para el seguimiento de pendientes por equipo.
export interface ChecklistItem {
  id: string;
  empresa_id: string;
  descripcion: string;
  observacion?: string | null;
  responsable?: string | null;
  url?: string | null;
  activo: boolean;
  creado_por: string;
  creado_por_nombre?: string;
  modificado_por?: string | null;
  modificado_por_nombre?: string | null;
  created_at: string;
  updated_at: string;
}

// Una "ejecucion" del checklist para un equipo -- se puede repetir mas de
// una vez (ej. cada vez que el equipo cambia de responsable), cada una
// asociada al usuario al que se le asigno el equipo en ese momento
// (asignado_a) y con su propia fecha.
export interface EquipoChecklistEjecucion {
  id: string;
  asignado_a?: string | null;
  fecha: string;
  creado_por_nombre?: string;
  total_items?: number;
  completados_count?: number;
}

export interface EquipoChecklistEjecucionDetalle extends EquipoChecklistEjecucion {
  items: EquipoChecklistItem[];
}

// Un item del catalogo Checklist dentro de una ejecucion puntual -- el
// join siempre trae TODOS los items activos del catalogo; completado es
// false por defecto mientras no se haya marcado para esa ejecucion.
export interface EquipoChecklistItem {
  checklist_id: string;
  descripcion: string;
  url?: string | null;
  completado: boolean;
  fecha_completado?: string | null;
  modificado_por_nombre?: string | null;
}

// Una fila del Reporte de Servicios: servicio + proveedor + sector + costo
// mensual + pagos totales ("pagada") dentro del rango de fechas pedido.
export interface ReporteServicioPagos {
  id: string;
  servicio: string;
  proveedor_nombre: string;
  sector_nombre: string | null;
  costo_mensual: number;
  estado: string;
  estado_clase_badge?: string;
  pagos_total_rango: number;
}

export interface ServicioProveedor {
  id: string;
  empresa_id: string;
  proveedor_id: string;
  proveedor_nombre?: string;
  proveedor_sector?: SectorProveedor;
  proveedor_sector_id?: string | null;
  proveedor_contactos?: ContactoProveedorPrincipal[];
  servicio: string;
  costo_mensual: number;
  costo_anual: number;
  fecha_inicio: string;
  fecha_fin?: string | null;
  fecha_corte_dia?: number | null;
  fecha_corte_mes?: number | null;
  es_indefinido: boolean;
  dias_aviso_vencimiento?: number | null;
  no_contrato?: string | null;
  observacion?: string | null;
  url?: string | null;
  responsable?: string | null;
  contactos: ContactoProveedor[];
  // Opcional: listar() ya no la trae (vive en su propia tabla ahora), solo
  // llega poblada cuando se pide obtenerPorId().
  imagenes?: ImagenServicioProveedor[];
  estado: string;
  estado_id?: string | null;
  estado_clase_badge?: string;
  creado_por: string;
  creado_por_nombre?: string;
  modificado_por?: string | null;
  modificado_por_nombre?: string | null;
  created_at: string;
  updated_at: string;
  facturas_count?: number;
  facturas_pendientes_count?: number;
  monto_total_pagado?: number;
  ultimo_pago_monto?: number | null;
  ultimo_pago_fecha?: string | null;
  penultimo_pago_monto?: number | null;
  incidentes_abiertos_count?: number;
  incidentes_total_count?: number;
  facturas?: FacturaServicioProveedor[];
  // Opcional: solo llega poblada cuando se pide obtenerPorId().
  incidentes?: ServicioIncidente[];
}

export type EstadoFacturaServicio = 'pagada' | 'anulada' | 'pendiente';
export type FormaPagoFactura = 'transferencia' | 'visa' | 'efectivo' | 'otro';

export interface FacturaServicioProveedor {
  id: string;
  servicio_proveedor_id: string;
  fecha_factura: string;
  monto_factura: number;
  estado: EstadoFacturaServicio;
  forma_pago: FormaPagoFactura;
  observaciones?: string | null;
  creado_por: string;
  creado_por_nombre?: string;
  modificado_por?: string | null;
  modificado_por_nombre?: string | null;
  created_at: string;
  updated_at?: string;
}

// CARRITO DE COMPRAS (solicitudes de compra de equipos). Estado
// estrictamente secuencial -- ver avanzarEstado() en CarritosService.
export type EstadoCarrito = 'en_construccion' | 'en_revision' | 'aprobada' | 'cerrada';

export interface Carrito {
  id: string;
  empresa_id: string;
  titulo: string;
  fecha_solicitud: string;
  fecha_aprobacion?: string | null;
  observacion?: string | null;
  estado: EstadoCarrito;
  creado_por: string;
  creado_por_nombre?: string;
  modificado_por?: string | null;
  modificado_por_nombre?: string | null;
  created_at: string;
  updated_at: string;
  costo_estimado_propuesto_total?: number;
  costo_estimado_aprobado_total?: number;
  // Opcional: solo llega poblada cuando se pide obtenerPorId().
  detalles?: CarritoDetalle[];
}

export interface CarritoDetalle {
  id: string;
  carrito_id: string;
  producto_id: number;
  producto_nombre?: string;
  categoria_id?: number;
  categoria_nombre?: string;
  marca: string;
  modelo: string;
  url?: string | null;
  proveedor_id?: string | null;
  proveedor_nombre?: string | null;
  cantidad_propuesta: number;
  cantidad_aprobada?: number | null;
  costo_estimado?: number | null;
  observacion?: string | null;
  creado_por: string;
  creado_por_nombre?: string;
  modificado_por?: string | null;
  modificado_por_nombre?: string | null;
  created_at: string;
  updated_at: string;
}

// Historico de cambios de estado de un carrito -- una fila por cada
// transicion (de null al crear, o de un estado a otro al avanzar/devolver).
export interface HistoricoMovimientoCarrito {
  id: string;
  carrito_id: string;
  estado_anterior: EstadoCarrito | null;
  estado_nuevo: EstadoCarrito;
  observacion?: string | null;
  registrado_por: string;
  registrado_por_nombre?: string;
  fecha_cambio: string;
}

// Entrada de la bitacora de un incidente: nota libre, cambio de estado
// y/o documento adjunto, cualquier combinacion, en un solo registro.
export interface IncidenteNota {
  id: string;
  incidente_id: string;
  nota?: string | null;
  estado_anterior?: EstadoIncidente | null;
  estado_nuevo?: EstadoIncidente | null;
  imagen_base64?: string | null;
  descripcion_adjunto?: string | null;
  creado_por: string;
  creado_por_nombre?: string;
  created_at: string;
}

export type EstadoIncidente = 'abierto' | 'en pausa' | 'cerrado';

export interface ServicioIncidente {
  id: string;
  servicio_proveedor_id: string;
  fecha_incidente: string;
  reportado_por: string;
  descripcion: string;
  no_ticket_fabricante?: string | null;
  estado: EstadoIncidente;
  creado_por: string;
  creado_por_nombre?: string;
  modificado_por?: string | null;
  modificado_por_nombre?: string | null;
  created_at: string;
  updated_at?: string;
  notas_count?: number;
}

