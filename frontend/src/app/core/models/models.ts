export type Rol = 'admin' | 'supervisor' | 'tecnico';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  activo: boolean;
  created_at?: string;
}

export interface UsuarioForm {
  nombre: string;
  email: string;
  password?: string;
  rol: Rol;
  activo: boolean;
}

export interface Cliente {
  id: string;
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
