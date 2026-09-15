-- ENUMS
create type public.app_role as enum ('admin','tecnico','rrhh');
create type public.estado_maquina as enum ('operativa','en_mantencion','fuera_de_servicio');
create type public.tipo_orden as enum ('preventiva','correctiva');
create type public.estado_orden as enum ('pendiente','en_proceso','completada','cancelada');

-- PERFILES
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null default '',
  email text not null default '',
  creado_en timestamptz not null default now()
);
grant select, insert, update on public.perfiles to authenticated;
grant all on public.perfiles to service_role;
alter table public.perfiles enable row level security;

-- ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
$$;

create policy "perfiles_select_all" on public.perfiles for select to authenticated using (true);
create policy "perfiles_update_own" on public.perfiles for update to authenticated using (auth.uid() = id);
create policy "perfiles_admin_update" on public.perfiles for update to authenticated using (public.is_admin());

create policy "roles_select_own_or_admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "roles_admin_all" on public.user_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- nuevo usuario: perfil + rol (primer usuario = admin)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_role public.app_role;
begin
  insert into public.perfiles (id, nombre, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)), coalesce(new.email,''));
  if exists (select 1 from public.user_roles where role = 'admin') then
    v_role := 'tecnico';
  else
    v_role := 'admin';
  end if;
  insert into public.user_roles (user_id, role) values (new.id, v_role);
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- MAQUINAS
create table public.maquinas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text not null unique,
  marca text,
  modelo text,
  ubicacion text,
  anio integer,
  foto_url text,
  estado public.estado_maquina not null default 'operativa',
  periodicidad_dias integer not null default 30,
  fecha_ultima_mantencion date,
  fecha_proxima_mantencion date,
  creado_en timestamptz not null default now()
);
grant select, insert, update, delete on public.maquinas to authenticated;
grant all on public.maquinas to service_role;
alter table public.maquinas enable row level security;
create policy "maquinas_select" on public.maquinas for select to authenticated using (true);
create policy "maquinas_admin_write" on public.maquinas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- INVENTARIO
create table public.inventario (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text not null unique,
  stock_actual numeric not null default 0,
  stock_minimo numeric not null default 0,
  unidad text not null default 'u',
  costo_unitario numeric not null default 0,
  proveedor text,
  maquina_id uuid references public.maquinas(id) on delete set null,
  creado_en timestamptz not null default now()
);
grant select, insert, update, delete on public.inventario to authenticated;
grant all on public.inventario to service_role;
alter table public.inventario enable row level security;
create policy "inventario_select" on public.inventario for select to authenticated using (true);
create policy "inventario_admin_write" on public.inventario for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- EMPLEADOS
create table public.empleados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  cargo text,
  area text,
  fecha_ingreso date,
  tarifa_hora numeric not null default 0,
  user_id uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now()
);
grant select, insert, update, delete on public.empleados to authenticated;
grant all on public.empleados to service_role;
alter table public.empleados enable row level security;
create policy "empleados_select" on public.empleados for select to authenticated using (true);
create policy "empleados_rrhh_write" on public.empleados for all to authenticated
  using (public.is_admin() or public.has_role(auth.uid(),'rrhh'))
  with check (public.is_admin() or public.has_role(auth.uid(),'rrhh'));

-- SUELDOS (solo admin/rrhh)
create table public.empleado_remuneraciones (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null unique references public.empleados(id) on delete cascade,
  sueldo_base numeric not null default 0,
  actualizado_en timestamptz not null default now()
);
grant select, insert, update, delete on public.empleado_remuneraciones to authenticated;
grant all on public.empleado_remuneraciones to service_role;
alter table public.empleado_remuneraciones enable row level security;
create policy "remuneraciones_rrhh" on public.empleado_remuneraciones for all to authenticated
  using (public.is_admin() or public.has_role(auth.uid(),'rrhh'))
  with check (public.is_admin() or public.has_role(auth.uid(),'rrhh'));

-- ORDENES DE TRABAJO
create table public.ordenes_trabajo (
  id uuid primary key default gen_random_uuid(),
  folio serial,
  maquina_id uuid not null references public.maquinas(id) on delete cascade,
  tipo public.tipo_orden not null default 'preventiva',
  estado public.estado_orden not null default 'pendiente',
  fecha_programada date not null,
  fecha_ejecucion date,
  tecnico_id uuid references public.empleados(id) on delete set null,
  horas_mano_obra numeric not null default 0,
  descripcion text,
  observaciones text,
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now()
);
grant select, insert, update, delete on public.ordenes_trabajo to authenticated;
grant all on public.ordenes_trabajo to service_role;
alter table public.ordenes_trabajo enable row level security;
create policy "ot_select" on public.ordenes_trabajo for select to authenticated using (true);
create policy "ot_insert" on public.ordenes_trabajo for insert to authenticated
  with check (public.is_admin() or public.has_role(auth.uid(),'tecnico'));
create policy "ot_update" on public.ordenes_trabajo for update to authenticated
  using (public.is_admin() or public.has_role(auth.uid(),'tecnico'));
create policy "ot_delete" on public.ordenes_trabajo for delete to authenticated using (public.is_admin());

-- INSUMOS DE LA ORDEN
create table public.orden_trabajo_insumos (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_trabajo(id) on delete cascade,
  insumo_id uuid not null references public.inventario(id) on delete restrict,
  cantidad_usada numeric not null check (cantidad_usada > 0),
  costo_al_momento numeric not null default 0,
  creado_en timestamptz not null default now()
);
grant select, insert, update, delete on public.orden_trabajo_insumos to authenticated;
grant all on public.orden_trabajo_insumos to service_role;
alter table public.orden_trabajo_insumos enable row level security;
create policy "oti_select" on public.orden_trabajo_insumos for select to authenticated using (true);
create policy "oti_write" on public.orden_trabajo_insumos for all to authenticated
  using (public.is_admin() or public.has_role(auth.uid(),'tecnico'))
  with check (public.is_admin() or public.has_role(auth.uid(),'tecnico'));

-- Descuento automático de stock
create or replace function public.aplicar_consumo_insumo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.costo_al_momento is null or new.costo_al_momento = 0 then
      select costo_unitario into new.costo_al_momento from public.inventario where id = new.insumo_id;
    end if;
    update public.inventario set stock_actual = stock_actual - new.cantidad_usada where id = new.insumo_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.inventario set stock_actual = stock_actual + old.cantidad_usada where id = old.insumo_id;
    return old;
  end if;
  return new;
end; $$;

create trigger trg_consumo_insumo_ins before insert on public.orden_trabajo_insumos
for each row execute function public.aplicar_consumo_insumo();
create trigger trg_consumo_insumo_del after delete on public.orden_trabajo_insumos
for each row execute function public.aplicar_consumo_insumo();

-- Al cerrar la orden, actualizar fechas de la máquina
create or replace function public.actualizar_mantencion_maquina()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_periodicidad integer;
begin
  if new.estado = 'completada' and (old.estado is distinct from 'completada') then
    if new.fecha_ejecucion is null then
      new.fecha_ejecucion := current_date;
    end if;
    select periodicidad_dias into v_periodicidad from public.maquinas where id = new.maquina_id;
    update public.maquinas
      set fecha_ultima_mantencion = new.fecha_ejecucion,
          fecha_proxima_mantencion = new.fecha_ejecucion + coalesce(v_periodicidad,30),
          estado = 'operativa'
    where id = new.maquina_id;
  end if;
  return new;
end; $$;

create trigger trg_cierre_orden before update on public.ordenes_trabajo
for each row execute function public.actualizar_mantencion_maquina();

-- DATOS DE EJEMPLO
insert into public.maquinas (nombre, codigo, marca, modelo, ubicacion, anio, estado, periodicidad_dias, fecha_ultima_mantencion, fecha_proxima_mantencion) values
('Compresor Atlas Copco GA75','MAC-001','Atlas Copco','GA75','Nave A · Piso 1',2019,'operativa',30, current_date - 12, current_date + 18),
('CNC Haas VF-2','MAC-014','Haas','VF-2','Nave B · Piso 1',2021,'operativa',30, current_date - 27, current_date + 3),
('Soplete industrial','MAC-007','Lincoln','PT-400','Nave A · Piso 2',2017,'en_mantencion',60, current_date - 70, current_date - 10),
('Pulidora Bosch GWS 22','MAC-021','Bosch','GWS 22','Nave C · Piso 1',2022,'operativa',90, current_date - 5, current_date + 85),
('Bomba Sumitor R-50','MAC-018','Sumitor','R-50','Nave A · Piso 3',2015,'fuera_de_servicio',30, current_date - 45, current_date - 15);

insert into public.inventario (nombre, codigo, stock_actual, stock_minimo, unidad, costo_unitario, proveedor) values
('Rodamiento SKF 6205','RPM-0042',2,10,'u',8500,'Rodasur'),
('Aceite hidráulico ISO 46','ACE-0110',24,10,'L',4200,'Lubritec'),
('Filtro de aire AF-220','FIL-0031',15,6,'u',12500,'FiltroMax'),
('Correa trapezoidal B-56','COR-0012',4,5,'u',6900,'Transmisiones SA'),
('Grasa multiuso EP2','GRA-0007',30,8,'kg',3100,'Lubritec');

insert into public.empleados (nombre, cargo, area, fecha_ingreso, tarifa_hora) values
('Javier Herrera','Técnico mecánico','Mantenimiento', current_date - 800, 9500),
('María Soto','Técnica eléctrica','Mantenimiento', current_date - 400, 10200),
('Pedro Lagos','Supervisor de planta','Operaciones', current_date - 1200, 13000),
('Carla Núñez','Analista RRHH','Administración', current_date - 300, 8800);

insert into public.empleado_remuneraciones (empleado_id, sueldo_base)
select id, case cargo when 'Supervisor de planta' then 1800000 when 'Analista RRHH' then 1200000 else 1400000 end from public.empleados;

insert into public.ordenes_trabajo (maquina_id, tipo, estado, fecha_programada, fecha_ejecucion, tecnico_id, horas_mano_obra, descripcion, observaciones)
select m.id, 'preventiva', 'completada', current_date - 12, current_date - 12, e.id, 3.5, 'Mantención preventiva programada', 'Sin observaciones'
from public.maquinas m, public.empleados e where m.codigo='MAC-001' and e.nombre='Javier Herrera';

insert into public.ordenes_trabajo (maquina_id, tipo, estado, fecha_programada, tecnico_id, descripcion)
select m.id, 'correctiva', 'pendiente', current_date + 3, e.id, 'Revisión de válvula de admisión'
from public.maquinas m, public.empleados e where m.codigo='MAC-018' and e.nombre='María Soto';
