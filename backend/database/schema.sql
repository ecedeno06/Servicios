-- =========================================================
-- Esquema de base de datos - Gestion de Horas de Servicio
-- Motor: PostgreSQL (Supabase)
-- Soporta multicompania: cada empresa comparte el mismo
-- esquema, filtrado por empresa_id (row-level multi-tenancy).
-- =========================================================

create extension if not exists "pgcrypto"; -- para gen_random_uuid()

-- ---------------------------------------------------------
-- Tabla: empresas (tenants del sistema)
-- ---------------------------------------------------------
create table if not exists empresas (
    id              uuid primary key default gen_random_uuid(),
    nombre          text not null,
    identificacion  text unique,          -- RUC / NIT / Cedula juridica de la empresa
    email           text,
    telefono        text,
    direccion       text,
    -- Logo en base64 (data URI), ej: "data:image/png;base64,..."
    logo            text,
    activo          boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Tabla: usuarios (usuarios del sistema: admin, supervisores,
-- tecnicos). Es GLOBAL: no pertenece a una sola empresa, un
-- mismo usuario puede pertenecer a varias (ver usuarios_empresas_rol).
-- ---------------------------------------------------------
create table if not exists usuarios (
    id              uuid primary key default gen_random_uuid(),
    nombre          text not null,
    email           text not null unique,
    password_hash   text not null,
    activo          boolean not null default true,
    -- Acceso global de super-administracion (gestiona todas las empresas),
    -- independiente del rol que tenga en usuarios_empresas_rol.
    es_super_admin  boolean not null default false,
    -- Foto de perfil en base64 (data URI), ej: "data:image/jpeg;base64,..."
    avatar          text,
    -- Se activa cuando un admin crea el usuario o le resetea la contrasena
    -- (la conoce, es temporal); se limpia sola cuando el propio usuario
    -- cambia su contrasena via /auth/password.
    debe_cambiar_password boolean not null default false,
    -- Pista de contrasena, opcional (ver GET /auth/pista, publico con
    -- rate-limit, consultado desde la pantalla de login).
    pista           text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Tabla: politica_password (singleton, una sola fila id=1) --
-- reglas configurables por super-admin para cualquier contrasena que se
-- defina en el sistema.
-- ---------------------------------------------------------
create table if not exists politica_password (
    id                                smallint primary key default 1 check (id = 1),
    longitud_minima                   integer not null default 8 check (longitud_minima >= 1),
    mayuscula_minima                  integer not null default 2 check (mayuscula_minima >= 0),
    minuscula_minima                  integer not null default 2 check (minuscula_minima >= 0),
    requiere_numero                   boolean not null default true,
    requiere_caracter_especial        boolean not null default true,
    -- Caracteres permitidos para satisfacer requiere_numero /
    -- requiere_caracter_especial (no una restriccion sobre el resto del
    -- password, solo de que clase cuenta como "cumple el requisito").
    caracteres_numericos              text not null default '1234567890',
    caracteres_especiales             text not null default '!@#$%^&*-_+=.,',
    pista_longitud_minima             integer not null default 4 check (pista_longitud_minima >= 1),
    pista_similitud_maxima_porcentaje integer not null default 70 check (pista_similitud_maxima_porcentaje between 0 and 100),
    updated_at                        timestamptz not null default now()
);

insert into politica_password (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------
-- Tabla: password_reset_tokens -- recuperar contrasena por correo
-- (self-service). No tiene relacion con "pista" (esa solo muestra una
-- ayuda, no restablece nada).
-- ---------------------------------------------------------
create table if not exists password_reset_tokens (
    id          uuid primary key default gen_random_uuid(),
    usuario_id  uuid not null references usuarios(id) on delete cascade,
    token       text not null unique,
    expira_en   timestamptz not null,
    usado       boolean not null default false,
    created_at  timestamptz not null default now()
);

create index if not exists idx_password_reset_tokens_usuario on password_reset_tokens(usuario_id);
create index if not exists idx_password_reset_tokens_token_activo on password_reset_tokens(token) where usado = false;

-- ---------------------------------------------------------
-- Tabla: sesiones -- auditoria de sesiones (login/logout), portada de
-- "agro 1.1". requireAuth valida contra esta tabla en cada peticion
-- (ademas de la firma del JWT), lo que permite cerrar sesiones activas o
-- bloquear el acceso de un usuario de verdad, no solo cosmeticamente.
-- ---------------------------------------------------------
create table if not exists sesiones (
    id                 uuid primary key default gen_random_uuid(),
    token              text not null unique,
    usuario_id         uuid not null references usuarios(id) on delete cascade,
    empresa_id         uuid references empresas(id) on delete set null,
    rol                text,
    activo             boolean not null default true,
    razon_salida       text,
    duracion_segundos  integer,
    ip_address         text,
    geo_pais           text,
    geo_region         text,
    geo_ciudad         text,
    geo_lat            double precision,
    geo_lon            double precision,
    creado_en          timestamptz not null default now(),
    expira_en          timestamptz not null,
    -- Ultima peticion autenticada real de esta sesion (requireAuth la
    -- actualiza en cada request). Permite detectar/cerrar una sesion
    -- abandonada (navegador cerrado, sin red) por inactividad real sin
    -- esperar a que el JWT expire solo.
    ultima_actividad   timestamptz not null default now()
);

create index if not exists idx_sesiones_usuario on sesiones(usuario_id);
create index if not exists idx_sesiones_empresa on sesiones(empresa_id);
create index if not exists idx_sesiones_token_activo on sesiones(token) where activo = true;

-- ---------------------------------------------------------
-- Tabla: usuarios_empresas_rol (relacion N:M usuario <-> empresa,
-- el rol es un atributo de esta relacion, no del usuario)
-- ---------------------------------------------------------
create table if not exists usuarios_empresas_rol (
    id              uuid primary key default gen_random_uuid(),
    usuario_id      uuid not null references usuarios(id) on delete cascade,
    empresa_id      uuid not null references empresas(id) on delete cascade,
    rol             text not null check (rol in ('admin', 'supervisor', 'tecnico', 'cliente')) default 'tecnico',
    -- Solo aplica (y es obligatorio) cuando rol = 'cliente': a que cliente
    -- de la empresa representa este usuario. FK hacia clientes(id) se
    -- agrega mas abajo, una vez que esa tabla ya existe.
    cliente_id      uuid,
    constraint chk_cliente_id_segun_rol check (
        (rol = 'cliente' and cliente_id is not null) or
        (rol <> 'cliente' and cliente_id is null)
    ),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    unique (usuario_id, empresa_id)
);

-- ---------------------------------------------------------
-- Tabla: clientes
-- ---------------------------------------------------------
create table if not exists clientes (
    id              uuid primary key default gen_random_uuid(),
    empresa_id      uuid not null references empresas(id),
    nombre          text not null,
    identificacion  text,                 -- RUC / NIT / Cedula juridica
    email           text,
    telefono        text,
    direccion       text,
    activo          boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

alter table usuarios_empresas_rol
    add constraint usuarios_empresas_rol_cliente_id_fkey
    foreign key (cliente_id) references clientes(id) on delete cascade;

-- ---------------------------------------------------------
-- Tabla: tipos_servicio (catalogo de servicios que se prestan)
-- ---------------------------------------------------------
create table if not exists tipos_servicio (
    id              uuid primary key default gen_random_uuid(),
    empresa_id      uuid not null references empresas(id),
    nombre          text not null,
    descripcion     text,
    activo          boolean not null default true,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Tabla: contratos (contrato firmado por un cliente)
-- ---------------------------------------------------------
create table if not exists contratos (
    id                  uuid primary key default gen_random_uuid(),
    empresa_id          uuid not null references empresas(id),
    cliente_id          uuid not null references clientes(id) on delete restrict,
    numero_contrato     text not null,
    fecha_inicio        date not null,
    fecha_fin           date,
    estado              text not null check (estado in ('activo','vencido','cancelado','finalizado')) default 'activo',
    observaciones       text,
    -- Documentos asociados (OneDrive u otro origen): [{ "nombre": "...", "url": "..." }, ...]
    documentos          jsonb not null default '[]'::jsonb,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    constraint chk_fechas check (fecha_fin is null or fecha_fin >= fecha_inicio)
);

-- ---------------------------------------------------------
-- Tabla: contrato_servicios (horas establecidas por tipo de
-- servicio dentro de cada contrato -> "bolsas de horas").
-- No lleva empresa_id propio: hereda el tenant via contrato_id.
-- ---------------------------------------------------------
create table if not exists contrato_servicios (
    id                  uuid primary key default gen_random_uuid(),
    contrato_id         uuid not null references contratos(id) on delete cascade,
    tipo_servicio_id    uuid not null references tipos_servicio(id) on delete restrict,
    horas_contratadas   numeric(10,2) not null check (horas_contratadas >= 0),
    -- Uno o mas contactos para este servicio dentro del contrato:
    -- [{ nombre, correo, telefono }, ...]
    contactos           jsonb,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),
    unique (contrato_id, tipo_servicio_id)
);

-- ---------------------------------------------------------
-- Tabla: registro_horas (horas realmente ejecutadas contra
-- el contrato / tipo de servicio, por un usuario/tecnico)
-- ---------------------------------------------------------
create table if not exists registro_horas (
    id                  uuid primary key default gen_random_uuid(),
    empresa_id          uuid not null references empresas(id),
    contrato_id         uuid not null references contratos(id) on delete cascade,
    tipo_servicio_id    uuid not null references tipos_servicio(id) on delete restrict,
    usuario_id          uuid not null references usuarios(id) on delete restrict,
    fecha               date not null default current_date,
    hora_inicio         time,
    hora_fin            time,
    horas               numeric(10,2) not null check (horas > 0),
    descripcion         text,
    -- Documentos asociados (OneDrive u otro origen): [{ "nombre": "...", "url": "..." }, ...]
    documentos          jsonb not null default '[]'::jsonb,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Tabla: comentarios (bitacora de seguimiento sobre un registro de
-- horas: solo se agregan, nunca se editan ni se borran)
-- ---------------------------------------------------------
create table if not exists comentarios (
    id                  uuid primary key default gen_random_uuid(),
    registro_horas_id   uuid not null references registro_horas(id) on delete cascade,
    usuario_id          uuid not null references usuarios(id) on delete restrict,
    nota                text not null,
    created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------
-- Tabla: comentarios_vistos (hasta que fecha vio cada usuario los
-- comentarios de cada registro de horas, para notificaciones de no-leidos)
-- ---------------------------------------------------------
create table if not exists comentarios_vistos (
    usuario_id          uuid not null references usuarios(id) on delete cascade,
    registro_horas_id   uuid not null references registro_horas(id) on delete cascade,
    visto_hasta         timestamptz not null default now(),
    primary key (usuario_id, registro_horas_id)
);

-- ---------------------------------------------------------
-- Restricciones unicas por empresa
-- ---------------------------------------------------------
alter table clientes       add constraint uq_clientes_empresa_identificacion unique (empresa_id, identificacion);
alter table tipos_servicio add constraint uq_tipos_servicio_empresa_nombre unique (empresa_id, nombre);
alter table contratos      add constraint uq_contratos_empresa_numero unique (empresa_id, numero_contrato);

-- ---------------------------------------------------------
-- Indices
-- ---------------------------------------------------------
create index if not exists idx_usuarios_empresas_rol_usuario on usuarios_empresas_rol(usuario_id);
create index if not exists idx_usuarios_empresas_rol_empresa on usuarios_empresas_rol(empresa_id);
create index if not exists idx_clientes_empresa on clientes(empresa_id);
create index if not exists idx_tipos_servicio_empresa on tipos_servicio(empresa_id);
create index if not exists idx_contratos_empresa on contratos(empresa_id);
create index if not exists idx_contratos_cliente on contratos(cliente_id);
create index if not exists idx_contrato_servicios_contrato on contrato_servicios(contrato_id);
create index if not exists idx_contrato_servicios_tipo on contrato_servicios(tipo_servicio_id);
create index if not exists idx_registro_horas_empresa on registro_horas(empresa_id);
create index if not exists idx_registro_horas_contrato on registro_horas(contrato_id);
create index if not exists idx_registro_horas_tipo on registro_horas(tipo_servicio_id);
create index if not exists idx_registro_horas_usuario on registro_horas(usuario_id);
create index if not exists idx_registro_horas_fecha on registro_horas(fecha);
create index if not exists idx_comentarios_registro on comentarios(registro_horas_id, created_at);

-- ---------------------------------------------------------
-- Vista: consumo de horas por servicio contratado
-- (horas contratadas vs ejecutadas vs disponibles)
-- ---------------------------------------------------------
create or replace view vista_consumo_horas as
select
    cs.id                   as contrato_servicio_id,
    c.id                    as contrato_id,
    c.empresa_id,
    c.numero_contrato,
    c.estado                as estado_contrato,
    cl.id                   as cliente_id,
    cl.nombre               as cliente_nombre,
    ts.id                   as tipo_servicio_id,
    ts.nombre               as tipo_servicio_nombre,
    cs.horas_contratadas,
    cs.contactos,
    coalesce(sum(rh.horas), 0)                              as horas_ejecutadas,
    cs.horas_contratadas - coalesce(sum(rh.horas), 0)       as horas_disponibles
from contrato_servicios cs
join contratos c        on c.id = cs.contrato_id
join clientes cl         on cl.id = c.cliente_id
join tipos_servicio ts   on ts.id = cs.tipo_servicio_id
left join registro_horas rh
       on rh.contrato_id = cs.contrato_id
      and rh.tipo_servicio_id = cs.tipo_servicio_id
group by cs.id, c.id, c.empresa_id, c.numero_contrato, c.estado, cl.id, cl.nombre, ts.id, ts.nombre, cs.horas_contratadas, cs.contactos;

-- ---------------------------------------------------------
-- Trigger generico para actualizar updated_at
-- ---------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

do $$
declare
    t text;
begin
    foreach t in array array['empresas','usuarios','usuarios_empresas_rol','clientes','tipos_servicio','contratos','contrato_servicios','registro_horas']
    loop
        execute format('drop trigger if exists trg_set_updated_at on %I', t);
        execute format('create trigger trg_set_updated_at before update on %I for each row execute function set_updated_at()', t);
    end loop;
end $$;

-- ---------------------------------------------------------
-- Datos iniciales (empresa por defecto + usuario administrador).
-- Cambiar password despues del primer login. Password de ejemplo:
-- "Admin123!" ya hasheado con bcrypt (10 rounds). Genera el tuyo
-- con el endpoint POST /api/usuarios o con un script de hash.
-- ---------------------------------------------------------
-- with nueva_empresa as (
--   insert into empresas (nombre) values ('Empresa Principal') returning id
-- ), nuevo_usuario as (
--   insert into usuarios (nombre, email, password_hash)
--   values ('Administrador', 'admin@empresa.com', '<hash_bcrypt_aqui>')
--   returning id
-- )
-- insert into usuarios_empresas_rol (usuario_id, empresa_id, rol)
-- select nuevo_usuario.id, nueva_empresa.id, 'admin'
-- from nuevo_usuario, nueva_empresa;

-- ---------------------------------------------------------
-- Tabla: categorias / productos -- catalogo de equipos tecnologicos.
-- Catalogo de referencia global (no depende de empresa_id) -- 74
-- categorias, 347 productos.
-- ---------------------------------------------------------
create table if not exists categorias (
    id      serial primary key,
    nombre  varchar(100) not null unique
);

create table if not exists productos (
    id            serial primary key,
    categoria_id  integer not null references categorias(id) on update cascade on delete restrict,
    nombre        varchar(150) not null,
    constraint uq_productos_categoria_nombre unique (categoria_id, nombre)
);

create index if not exists idx_productos_categoria_id on productos(categoria_id);

insert into categorias (nombre) values
    ('Router'),
    ('Router 4G/5G'),
    ('Router Wi-Fi'),
    ('Sistema Wi-Fi mesh'),
    ('ONT / Módem'),
    ('Switch'),
    ('Punto de acceso'),
    ('Controlador WLAN'),
    ('Gateway de seguridad / SD-WAN'),
    ('Firewall'),
    ('Balanceador de carga'),
    ('Radioenlace'),
    ('Transceptor SFP'),
    ('Servidor rack'),
    ('Servidor torre'),
    ('Servidor blade'),
    ('Hiperconvergente'),
    ('NAS'),
    ('Almacenamiento SAN'),
    ('Librería de cintas'),
    ('UPS'),
    ('Regulador de voltaje'),
    ('PDU'),
    ('Switch KVM'),
    ('Rack / gabinete'),
    ('Laptop'),
    ('Computadora de escritorio'),
    ('Estación de trabajo'),
    ('Mini PC'),
    ('Cliente ligero'),
    ('Computadora de placa única'),
    ('Procesador'),
    ('Tarjeta gráfica'),
    ('Memoria RAM'),
    ('Disco SSD'),
    ('Disco duro HDD'),
    ('Disco externo'),
    ('Monitor'),
    ('Proyector'),
    ('Pantalla interactiva'),
    ('Impresora láser'),
    ('Multifuncional'),
    ('Impresora térmica / etiquetas'),
    ('Plotter'),
    ('Impresora 3D'),
    ('Escáner'),
    ('Lector de código de barras'),
    ('Terminal móvil robusta'),
    ('Terminal punto de venta'),
    ('Lector biométrico'),
    ('Lector de tarjetas inteligentes'),
    ('Llave de seguridad FIDO2'),
    ('Token OTP'),
    ('HSM'),
    ('Appliance PAM'),
    ('Cámara web'),
    ('Teclado / ratón'),
    ('Audífonos / diadema'),
    ('Estación de acoplamiento'),
    ('Teléfono IP'),
    ('Central telefónica IP'),
    ('Videoconferencia'),
    ('Radio portátil'),
    ('Smartphone'),
    ('Tableta'),
    ('Reloj inteligente'),
    ('Cámara IP'),
    ('NVR'),
    ('Control de acceso'),
    ('Domótica / IoT'),
    ('PLC'),
    ('HMI'),
    ('Dron'),
    ('Visor VR / AR')
on conflict (nombre) do nothing;

insert into productos (categoria_id, nombre)
select c.id, v.producto
from (values
    ('Router', 'TP-Link ER605'),
    ('Router', 'TP-Link ER7206'),
    ('Router', 'Cisco ISR 1111-4P'),
    ('Router', 'Cisco ISR 4331'),
    ('Router', 'MikroTik RB5009UG+S+IN'),
    ('Router', 'MikroTik hEX RB750Gr3'),
    ('Router', 'Ubiquiti EdgeRouter X'),
    ('Router', 'Juniper SRX300'),
    ('Router 4G/5G', 'Huawei B535-232'),
    ('Router 4G/5G', 'Teltonika RUT241'),
    ('Router 4G/5G', 'Teltonika RUTX50'),
    ('Router Wi-Fi', 'TP-Link Archer AX55'),
    ('Router Wi-Fi', 'ASUS RT-AX86U'),
    ('Router Wi-Fi', 'Netgear Nighthawk RAX50'),
    ('Sistema Wi-Fi mesh', 'TP-Link Deco X20'),
    ('Sistema Wi-Fi mesh', 'eero 6+'),
    ('Sistema Wi-Fi mesh', 'Google Nest Wifi Pro'),
    ('Sistema Wi-Fi mesh', 'ASUS ZenWiFi XT8'),
    ('ONT / Módem', 'Huawei HG8145V5'),
    ('ONT / Módem', 'ZTE F670L'),
    ('Switch', 'Cisco Catalyst 9200L-24P-4G'),
    ('Switch', 'Cisco Catalyst 9300-48P'),
    ('Switch', 'Cisco CBS350-24P-4G'),
    ('Switch', 'Aruba 2930F 24G'),
    ('Switch', 'HPE Aruba Instant On 1930 24G'),
    ('Switch', 'Ubiquiti UniFi USW-Pro-24-PoE'),
    ('Switch', 'TP-Link TL-SG3428'),
    ('Switch', 'Juniper EX2300-24P'),
    ('Switch', 'MikroTik CRS326-24G-2S+RM'),
    ('Switch', 'Dell PowerSwitch S5248F-ON'),
    ('Punto de acceso', 'Ubiquiti UniFi U6 Pro'),
    ('Punto de acceso', 'Ubiquiti UniFi U6 Lite'),
    ('Punto de acceso', 'Cisco Meraki MR36'),
    ('Punto de acceso', 'Cisco Catalyst 9120AXI'),
    ('Punto de acceso', 'Aruba AP-515'),
    ('Punto de acceso', 'HPE Aruba Instant On AP22'),
    ('Punto de acceso', 'TP-Link Omada EAP650'),
    ('Punto de acceso', 'Ruckus R650'),
    ('Controlador WLAN', 'Cisco Catalyst 9800-L'),
    ('Controlador WLAN', 'Aruba 7205'),
    ('Controlador WLAN', 'TP-Link Omada OC200'),
    ('Controlador WLAN', 'Ubiquiti UniFi Cloud Key Gen2 Plus'),
    ('Gateway de seguridad / SD-WAN', 'Cisco Meraki MX68'),
    ('Gateway de seguridad / SD-WAN', 'Cisco Meraki MX85'),
    ('Gateway de seguridad / SD-WAN', 'Ubiquiti UniFi Dream Machine Pro'),
    ('Firewall', 'Fortinet FortiGate 60F'),
    ('Firewall', 'Fortinet FortiGate 100F'),
    ('Firewall', 'Palo Alto Networks PA-440'),
    ('Firewall', 'Palo Alto Networks PA-3220'),
    ('Firewall', 'Cisco Firepower 1010'),
    ('Firewall', 'Sophos XGS 2100'),
    ('Firewall', 'SonicWall TZ370'),
    ('Firewall', 'Check Point Quantum Spark 1570'),
    ('Balanceador de carga', 'F5 BIG-IP i2800'),
    ('Balanceador de carga', 'F5 BIG-IP i4800'),
    ('Radioenlace', 'Ubiquiti NanoBeam 5AC Gen2'),
    ('Radioenlace', 'Ubiquiti LiteBeam 5AC Gen2'),
    ('Radioenlace', 'MikroTik SXTsq 5 ac'),
    ('Radioenlace', 'Cambium ePMP Force 300-25'),
    ('Transceptor SFP', 'Cisco GLC-SX-MMD'),
    ('Transceptor SFP', 'Cisco SFP-10G-SR'),
    ('Servidor rack', 'Dell PowerEdge R650'),
    ('Servidor rack', 'Dell PowerEdge R750'),
    ('Servidor rack', 'Dell PowerEdge R760'),
    ('Servidor rack', 'HPE ProLiant DL360 Gen10 Plus'),
    ('Servidor rack', 'HPE ProLiant DL380 Gen11'),
    ('Servidor rack', 'Lenovo ThinkSystem SR630 V2'),
    ('Servidor rack', 'Lenovo ThinkSystem SR650 V3'),
    ('Servidor rack', 'Cisco UCS C220 M6'),
    ('Servidor torre', 'Dell PowerEdge T150'),
    ('Servidor torre', 'Dell PowerEdge T350'),
    ('Servidor torre', 'Dell PowerEdge T550'),
    ('Servidor torre', 'HPE ProLiant ML30 Gen10 Plus'),
    ('Servidor torre', 'HPE ProLiant ML110 Gen10'),
    ('Servidor torre', 'Lenovo ThinkSystem ST50 V2'),
    ('Servidor torre', 'Lenovo ThinkSystem ST250 V2'),
    ('Servidor blade', 'HPE Synergy 480 Gen10'),
    ('Servidor blade', 'Cisco UCS B200 M5'),
    ('Servidor blade', 'Dell PowerEdge MX750c'),
    ('Hiperconvergente', 'Dell VxRail E660'),
    ('Hiperconvergente', 'Dell VxRail P670F'),
    ('Hiperconvergente', 'HPE SimpliVity 380 Gen10'),
    ('NAS', 'Synology DS224+'),
    ('NAS', 'Synology DS923+'),
    ('NAS', 'Synology RS1221+'),
    ('NAS', 'QNAP TS-464'),
    ('NAS', 'QNAP TS-873A'),
    ('NAS', 'WD My Cloud EX2 Ultra'),
    ('Almacenamiento SAN', 'Dell PowerStore 500T'),
    ('Almacenamiento SAN', 'Dell PowerVault ME5024'),
    ('Almacenamiento SAN', 'NetApp AFF A250'),
    ('Almacenamiento SAN', 'NetApp FAS2750'),
    ('Almacenamiento SAN', 'HPE MSA 2060'),
    ('Almacenamiento SAN', 'Pure Storage FlashArray//X'),
    ('Almacenamiento SAN', 'IBM FlashSystem 5200'),
    ('Librería de cintas', 'IBM TS4300'),
    ('Librería de cintas', 'Quantum Scalar i3'),
    ('Librería de cintas', 'HPE StoreEver MSL3040'),
    ('Librería de cintas', 'Dell PowerVault TL1000'),
    ('UPS', 'APC Smart-UPS SMT1500'),
    ('UPS', 'APC Smart-UPS SMT3000RM2U'),
    ('UPS', 'APC Back-UPS BX1500M'),
    ('UPS', 'Eaton 5PX 1500'),
    ('UPS', 'Eaton 9PX 3000'),
    ('UPS', 'Vertiv Liebert GXT5 3000'),
    ('UPS', 'CyberPower CP1500PFCLCD'),
    ('Regulador de voltaje', 'APC Line-R LE1200'),
    ('PDU', 'APC AP7900B'),
    ('PDU', 'APC AP7921B'),
    ('PDU', 'Tripp Lite PDUMH20'),
    ('Switch KVM', 'ATEN CS1708A'),
    ('Switch KVM', 'ATEN CL5708'),
    ('Switch KVM', 'Raritan Dominion KX IV-101'),
    ('Rack / gabinete', 'APC NetShelter SX AR3100'),
    ('Rack / gabinete', 'Tripp Lite SR42UB'),
    ('Laptop', 'Dell Latitude 5440'),
    ('Laptop', 'Dell Latitude 7440'),
    ('Laptop', 'Lenovo ThinkPad T14 Gen 4'),
    ('Laptop', 'Lenovo ThinkPad X1 Carbon Gen 11'),
    ('Laptop', 'Lenovo ThinkPad E14 Gen 5'),
    ('Laptop', 'HP EliteBook 840 G10'),
    ('Laptop', 'HP ProBook 450 G10'),
    ('Laptop', 'Apple MacBook Air 13 M3'),
    ('Laptop', 'Apple MacBook Pro 14 M3'),
    ('Laptop', 'ASUS Zenbook 14 OLED'),
    ('Laptop', 'Acer Aspire 5'),
    ('Laptop', 'Microsoft Surface Laptop 5'),
    ('Computadora de escritorio', 'Dell OptiPlex 7010'),
    ('Computadora de escritorio', 'Dell OptiPlex 3000'),
    ('Computadora de escritorio', 'HP ProDesk 400 G9'),
    ('Computadora de escritorio', 'HP EliteDesk 800 G9'),
    ('Computadora de escritorio', 'Lenovo ThinkCentre M70q Gen 4'),
    ('Computadora de escritorio', 'Lenovo ThinkCentre M90t'),
    ('Computadora de escritorio', 'Apple Mac mini M2'),
    ('Computadora de escritorio', 'Apple iMac 24 M3'),
    ('Estación de trabajo', 'Dell Precision 3660'),
    ('Estación de trabajo', 'Dell Precision 5680'),
    ('Estación de trabajo', 'HP Z2 G9'),
    ('Estación de trabajo', 'HP Z4 G5'),
    ('Estación de trabajo', 'Lenovo ThinkStation P3 Tower'),
    ('Estación de trabajo', 'Lenovo ThinkStation P620'),
    ('Mini PC', 'Intel NUC 13 Pro'),
    ('Mini PC', 'ASUS NUC 14 Pro'),
    ('Cliente ligero', 'HP t640'),
    ('Cliente ligero', 'Dell Wyse 5070'),
    ('Cliente ligero', 'IGEL UD3'),
    ('Computadora de placa única', 'Raspberry Pi 5'),
    ('Computadora de placa única', 'Raspberry Pi 4 Model B'),
    ('Computadora de placa única', 'NVIDIA Jetson Orin Nano'),
    ('Computadora de placa única', 'Arduino Uno R4'),
    ('Procesador', 'Intel Core i5-13400'),
    ('Procesador', 'Intel Core i7-14700K'),
    ('Procesador', 'Intel Xeon Silver 4314'),
    ('Procesador', 'AMD Ryzen 5 7600'),
    ('Procesador', 'AMD Ryzen 7 7800X3D'),
    ('Procesador', 'AMD EPYC 9354'),
    ('Tarjeta gráfica', 'NVIDIA GeForce RTX 4060'),
    ('Tarjeta gráfica', 'NVIDIA GeForce RTX 4090'),
    ('Tarjeta gráfica', 'NVIDIA RTX A4000'),
    ('Tarjeta gráfica', 'NVIDIA H100'),
    ('Tarjeta gráfica', 'AMD Radeon RX 7800 XT'),
    ('Memoria RAM', 'Kingston Fury Beast DDR5 16GB'),
    ('Memoria RAM', 'Crucial DDR4 16GB 3200'),
    ('Memoria RAM', 'Corsair Vengeance DDR5 32GB'),
    ('Disco SSD', 'Samsung 870 EVO 1TB'),
    ('Disco SSD', 'Samsung 990 PRO 2TB'),
    ('Disco SSD', 'Crucial MX500 1TB'),
    ('Disco SSD', 'Kingston NV2 1TB'),
    ('Disco SSD', 'WD Blue SN580 1TB'),
    ('Disco duro HDD', 'Seagate BarraCuda 2TB'),
    ('Disco duro HDD', 'Seagate IronWolf 8TB'),
    ('Disco duro HDD', 'Seagate Exos X18 16TB'),
    ('Disco duro HDD', 'WD Red Plus 4TB'),
    ('Disco duro HDD', 'WD Purple 4TB'),
    ('Disco duro HDD', 'Toshiba N300 8TB'),
    ('Disco externo', 'Samsung T7 1TB'),
    ('Disco externo', 'SanDisk Extreme Portable SSD 1TB'),
    ('Disco externo', 'WD My Passport 2TB'),
    ('Disco externo', 'Seagate Expansion 4TB'),
    ('Monitor', 'Dell P2423D'),
    ('Monitor', 'Dell U2723QE'),
    ('Monitor', 'HP E24 G5'),
    ('Monitor', 'LG 27UP850-W'),
    ('Monitor', 'Samsung Odyssey G7'),
    ('Monitor', 'BenQ PD2705U'),
    ('Monitor', 'Lenovo ThinkVision T24i-30'),
    ('Proyector', 'Epson PowerLite 2250U'),
    ('Proyector', 'Epson EB-X49'),
    ('Proyector', 'BenQ MW560'),
    ('Proyector', 'Optoma HD146X'),
    ('Pantalla interactiva', 'Samsung Flip Pro WM75B'),
    ('Pantalla interactiva', 'Microsoft Surface Hub 2S'),
    ('Pantalla interactiva', 'Promethean ActivPanel 9'),
    ('Impresora láser', 'HP LaserJet Pro M404dn'),
    ('Impresora láser', 'HP LaserJet Pro 4001dn'),
    ('Impresora láser', 'Brother HL-L2350DW'),
    ('Impresora láser', 'Brother HL-L5200DW'),
    ('Impresora láser', 'Canon imageCLASS LBP6230dw'),
    ('Impresora láser', 'Lexmark MS521dn'),
    ('Multifuncional', 'HP LaserJet Pro MFP M428fdw'),
    ('Multifuncional', 'Brother MFC-L8900CDW'),
    ('Multifuncional', 'Epson EcoTank L3250'),
    ('Multifuncional', 'Epson EcoTank L5290'),
    ('Multifuncional', 'Canon PIXMA G3110'),
    ('Multifuncional', 'Ricoh IM C3000'),
    ('Multifuncional', 'Xerox VersaLink C405'),
    ('Impresora térmica / etiquetas', 'Zebra ZD421'),
    ('Impresora térmica / etiquetas', 'Zebra ZT411'),
    ('Impresora térmica / etiquetas', 'Zebra GK420d'),
    ('Impresora térmica / etiquetas', 'Epson TM-T20III'),
    ('Impresora térmica / etiquetas', 'Epson TM-T88VI'),
    ('Impresora térmica / etiquetas', 'Brother QL-800'),
    ('Plotter', 'HP DesignJet T230'),
    ('Plotter', 'HP DesignJet T650'),
    ('Plotter', 'Canon imagePROGRAF TM-300'),
    ('Plotter', 'Epson SureColor T3170'),
    ('Impresora 3D', 'Prusa MK4'),
    ('Impresora 3D', 'Bambu Lab X1 Carbon'),
    ('Impresora 3D', 'Bambu Lab P1S'),
    ('Impresora 3D', 'Creality Ender-3 V3'),
    ('Impresora 3D', 'Formlabs Form 4'),
    ('Impresora 3D', 'UltiMaker S5'),
    ('Escáner', 'Fujitsu fi-8170'),
    ('Escáner', 'Fujitsu ScanSnap iX1600'),
    ('Escáner', 'Epson WorkForce DS-530 II'),
    ('Escáner', 'Canon imageFORMULA DR-C225 II'),
    ('Escáner', 'Brother ADS-2200'),
    ('Lector de código de barras', 'Zebra DS2208'),
    ('Lector de código de barras', 'Zebra LI4278'),
    ('Lector de código de barras', 'Honeywell Voyager 1250g'),
    ('Lector de código de barras', 'Honeywell Xenon 1950g'),
    ('Lector de código de barras', 'Datalogic QuickScan QD2430'),
    ('Terminal móvil robusta', 'Zebra TC52'),
    ('Terminal móvil robusta', 'Zebra TC58'),
    ('Terminal móvil robusta', 'Zebra MC3300'),
    ('Terminal móvil robusta', 'Honeywell CT40'),
    ('Terminal móvil robusta', 'Honeywell CT60'),
    ('Terminal punto de venta', 'Verifone V200c'),
    ('Terminal punto de venta', 'PAX A920'),
    ('Lector biométrico', 'ZKTeco K40'),
    ('Lector biométrico', 'ZKTeco SpeedFace-V5L'),
    ('Lector biométrico', 'Suprema BioStation 3'),
    ('Lector biométrico', 'Suprema BioEntry W3'),
    ('Lector biométrico', 'HID DigitalPersona 4500'),
    ('Lector de tarjetas inteligentes', 'HID OMNIKEY 3121'),
    ('Lector de tarjetas inteligentes', 'HID OMNIKEY 5422'),
    ('Lector de tarjetas inteligentes', 'Identiv uTrust SCR3310'),
    ('Llave de seguridad FIDO2', 'Yubico YubiKey 5 NFC'),
    ('Llave de seguridad FIDO2', 'Yubico YubiKey 5C NFC'),
    ('Llave de seguridad FIDO2', 'Yubico YubiKey Bio'),
    ('Llave de seguridad FIDO2', 'Google Titan Security Key'),
    ('Llave de seguridad FIDO2', 'Feitian ePass FIDO'),
    ('Token OTP', 'RSA SecurID SID700'),
    ('Token OTP', 'Thales SafeNet OTP 110'),
    ('Token OTP', 'Feitian c200'),
    ('HSM', 'Thales Luna Network HSM 7'),
    ('HSM', 'Entrust nShield Connect XC'),
    ('HSM', 'Utimaco SecurityServer Se Gen2'),
    ('HSM', 'Yubico YubiHSM 2'),
    ('Appliance PAM', 'BeyondTrust U-Series Appliance'),
    ('Cámara web', 'Logitech C270'),
    ('Cámara web', 'Logitech C920'),
    ('Cámara web', 'Logitech Brio 4K'),
    ('Cámara web', 'Microsoft LifeCam HD-3000'),
    ('Cámara web', 'Razer Kiyo Pro'),
    ('Teclado / ratón', 'Logitech MK270'),
    ('Teclado / ratón', 'Logitech MX Keys'),
    ('Teclado / ratón', 'Logitech MX Master 3S'),
    ('Teclado / ratón', 'Logitech M185'),
    ('Audífonos / diadema', 'Jabra Evolve2 40'),
    ('Audífonos / diadema', 'Jabra Evolve2 65'),
    ('Audífonos / diadema', 'Jabra BIZ 2300'),
    ('Audífonos / diadema', 'Poly Voyager Focus 2'),
    ('Audífonos / diadema', 'Sony WH-1000XM5'),
    ('Estación de acoplamiento', 'Dell WD19S'),
    ('Estación de acoplamiento', 'Dell WD22TB4'),
    ('Estación de acoplamiento', 'Lenovo ThinkPad Universal USB-C Dock'),
    ('Estación de acoplamiento', 'HP USB-C Dock G5'),
    ('Estación de acoplamiento', 'CalDigit TS4'),
    ('Teléfono IP', 'Cisco IP Phone 7841'),
    ('Teléfono IP', 'Cisco IP Phone 8841'),
    ('Teléfono IP', 'Yealink T31P'),
    ('Teléfono IP', 'Yealink T54W'),
    ('Teléfono IP', 'Grandstream GRP2612'),
    ('Teléfono IP', 'Poly CCX 400'),
    ('Central telefónica IP', 'Grandstream UCM6302'),
    ('Central telefónica IP', 'Cisco Business Edition 6000'),
    ('Central telefónica IP', 'Avaya IP Office 500 V2'),
    ('Central telefónica IP', 'Panasonic KX-NS700'),
    ('Videoconferencia', 'Poly Studio X50'),
    ('Videoconferencia', 'Poly Studio USB'),
    ('Videoconferencia', 'Logitech Rally Bar'),
    ('Videoconferencia', 'Logitech MeetUp'),
    ('Videoconferencia', 'Cisco Room Kit Mini'),
    ('Videoconferencia', 'Yealink MeetingBar A20'),
    ('Videoconferencia', 'Jabra PanaCast 50'),
    ('Radio portátil', 'Motorola DEP450'),
    ('Radio portátil', 'Kenwood TK-3402'),
    ('Radio portátil', 'Hytera BD505'),
    ('Smartphone', 'Apple iPhone 15'),
    ('Smartphone', 'Apple iPhone 16 Pro'),
    ('Smartphone', 'Samsung Galaxy S24'),
    ('Smartphone', 'Samsung Galaxy A55'),
    ('Smartphone', 'Google Pixel 9'),
    ('Smartphone', 'Xiaomi Redmi Note 13'),
    ('Smartphone', 'Motorola Moto G84'),
    ('Tableta', 'Apple iPad 10.ª generación'),
    ('Tableta', 'Apple iPad Pro 11 M4'),
    ('Tableta', 'Samsung Galaxy Tab S9'),
    ('Tableta', 'Samsung Galaxy Tab A9+'),
    ('Tableta', 'Lenovo Tab M10 Plus'),
    ('Reloj inteligente', 'Apple Watch Series 10'),
    ('Reloj inteligente', 'Samsung Galaxy Watch7'),
    ('Reloj inteligente', 'Garmin Forerunner 265'),
    ('Cámara IP', 'Hikvision DS-2CD2043G2-I'),
    ('Cámara IP', 'Hikvision DS-2CD2143G2-I'),
    ('Cámara IP', 'Dahua IPC-HFW2431S-S-S2'),
    ('Cámara IP', 'Axis M3106-L Mk II'),
    ('Cámara IP', 'Axis P3265-LVE'),
    ('Cámara IP', 'Ubiquiti UniFi G4 Bullet'),
    ('Cámara IP', 'Hanwha XNV-6080R'),
    ('NVR', 'Hikvision DS-7608NI-K2/8P'),
    ('NVR', 'Dahua NVR4108HS-8P-4KS2/L'),
    ('NVR', 'Ubiquiti UniFi UNVR'),
    ('Control de acceso', 'HID Signo 20'),
    ('Control de acceso', 'HID Signo 40'),
    ('Control de acceso', 'ZKTeco inBio 460'),
    ('Control de acceso', 'Suprema BioStation 2'),
    ('Domótica / IoT', 'Amazon Echo Dot 5.ª generación'),
    ('Domótica / IoT', 'Google Nest Mini'),
    ('Domótica / IoT', 'Google Nest Learning Thermostat'),
    ('Domótica / IoT', 'Philips Hue Bridge'),
    ('Domótica / IoT', 'TP-Link Tapo P100'),
    ('Domótica / IoT', 'Shelly Plus 1'),
    ('PLC', 'Siemens SIMATIC S7-1200'),
    ('PLC', 'Siemens SIMATIC S7-1500'),
    ('PLC', 'Allen-Bradley CompactLogix 5380'),
    ('PLC', 'Schneider Modicon M221'),
    ('HMI', 'Siemens SIMATIC KTP700 Basic'),
    ('HMI', 'Allen-Bradley PanelView 5310'),
    ('Dron', 'DJI Mini 4 Pro'),
    ('Dron', 'DJI Mavic 3 Enterprise'),
    ('Dron', 'DJI Matrice 350 RTK'),
    ('Visor VR / AR', 'Meta Quest 3'),
    ('Visor VR / AR', 'Apple Vision Pro'),
    ('Visor VR / AR', 'Microsoft HoloLens 2'),
    ('Visor VR / AR', 'HTC Vive Focus 3')
) as v(categoria, producto)
join categorias c on c.nombre = v.categoria
on conflict (categoria_id, nombre) do nothing;

-- ---------------------------------------------------------
-- Tabla: procesadores -- catalogo global de tipos de CPU, administrado
-- igual que categorias/productos. Se usa en las especificaciones
-- tecnicas de un equipo asignado.
-- ---------------------------------------------------------
create table if not exists procesadores (
    id      serial primary key,
    nombre  varchar(100) not null unique
);

insert into procesadores (nombre) values
    ('Intel Core i3'),
    ('Intel Core i5'),
    ('Intel Core i7'),
    ('Intel Core i9'),
    ('AMD Ryzen 5'),
    ('AMD Ryzen 7'),
    ('AMD Ryzen 9'),
    ('Apple M1'),
    ('Apple M2'),
    ('Apple M3'),
    ('Apple M4'),
    ('Apple M5')
on conflict (nombre) do nothing;

-- ---------------------------------------------------------
-- Tabla: equipos_asignados -- tabla intermedia entre el catalogo global
-- de productos y empresas. Registra cada unidad fisica de equipo que una
-- empresa tiene, con su estado y a quien esta asignada.
-- ---------------------------------------------------------
create table if not exists equipos_asignados (
    id                    uuid primary key default gen_random_uuid(),
    empresa_id            uuid not null references empresas(id) on delete cascade,
    producto_id           integer not null references productos(id) on delete restrict,
    marca                 text not null,
    modelo                text not null,
    fecha_entrada         date not null default current_date,
    vida_util_meses       integer check (vida_util_meses is null or vida_util_meses > 0),
    estado                text not null default 'stock' check (estado in ('en_uso', 'stock', 'reparacion', 'descarte', 'vendida')),
    asignada_a            text,
    observacion           text,
    -- Especificaciones tecnicas, todas opcionales.
    procesador_id         integer references procesadores(id) on delete set null,
    memoria_ram           text,
    disco_duro            text,
    numero_serie          text,
    numero_puertos        integer check (numero_puertos is null or numero_puertos >= 0),
    numero_puertos_hdmi   integer check (numero_puertos_hdmi is null or numero_puertos_hdmi >= 0),
    creado_por            uuid not null references usuarios(id),
    modificado_por        uuid references usuarios(id),
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);

create index if not exists idx_equipos_asignados_empresa on equipos_asignados(empresa_id);
create index if not exists idx_equipos_asignados_producto on equipos_asignados(producto_id);
create index if not exists idx_equipos_asignados_procesador on equipos_asignados(procesador_id);

drop trigger if exists trg_set_updated_at on equipos_asignados;
create trigger trg_set_updated_at before update on equipos_asignados for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- Tabla: equipos_historial -- historico de cambios de estado de un
-- equipo asignado. Se llena desde el backend (no con un trigger): un
-- movimiento al crear el equipo, y uno nuevo cada vez que el estado
-- cambia al editarlo.
-- ---------------------------------------------------------
create table if not exists equipos_historial (
    id                  uuid primary key default gen_random_uuid(),
    equipo_asignado_id  uuid not null references equipos_asignados(id) on delete cascade,
    estado_anterior     text,
    estado_nuevo        text not null,
    asignada_a          text,
    observacion         text,
    registrado_por      uuid not null references usuarios(id),
    fecha_cambio        timestamptz not null default now()
);

create index if not exists idx_equipos_historial_equipo on equipos_historial(equipo_asignado_id);

-- ---------------------------------------------------------
-- Nota sobre RLS (Row Level Security):
-- Este proyecto usa un backend Node.js/Express que se conecta
-- con la cadena de conexion directa de Postgres (o el rol de
-- servicio de Supabase), por lo que RLS puede permanecer
-- deshabilitado ya que el control de acceso se hace en la API
-- filtrando por empresa_id. Se puede activar como capa adicional
-- de defensa en profundidad (ver MULTICOMPANIA.md, seccion 3.6).
-- ---------------------------------------------------------
