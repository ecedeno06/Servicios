export type Rol = 'admin' | 'supervisor' | 'tecnico';

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
  created_at?: string;
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

export interface ContratoServicio {
  id: string;
  contrato_id: string;
  tipo_servicio_id: string;
  horas_contratadas: number;
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
  horas_ejecutadas: number;
  horas_disponibles: number;
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
  documentos?: Documento[];
  created_at?: string;
}
