# ERP

Quiero que construyas una aplicación web tipo ERP para gestión de maquinaria industrial y mantenimiento, orientada a un equipo pequeño (entre 10 y 20 usuarios). La app debe ser profesional, intuitiva, ordenada visualmente y fácil de usar incluso para personal no técnico (técnicos de terreno, supervisores, administrativos).

1. Stack técnico

Frontend: React + Tailwind, componentes limpios tipo dashboard administrativo (sidebar de navegación fija + contenido principal).

Backend / Base de datos: Supabase (Postgres). Usa Supabase Auth para autenticación y Row Level Security (RLS) para controlar permisos por rol.

La base de datos debe quedar estructurada con tablas relacionales (no documentos sueltos), ya que hay relaciones fuertes entre maquinaria, mantenciones, inventario y costos.

2. Roles de usuario y permisos

Crea 3 roles con permisos distintos, controlados por Supabase Auth + una tabla usuarios con columna rol:

Admin: acceso total (maquinaria, inventario, órdenes de trabajo, empleados, sueldos, reportes, configuración de usuarios).

Técnico: puede ver maquinaria e inventario, crear/actualizar órdenes de trabajo y registrar consumo de insumos/repuestos usados en una mantención. No ve sueldos ni reportes financieros.

RRHH / Administrativo: acceso a empleados y sueldos, y a reportes de costos, pero no puede editar maquinaria ni inventario técnico.

Muestra/oculta secciones del menú lateral según el rol logueado.

3. Módulos funcionales

A. Maquinaria

Listado de todas las máquinas (tarjetas o tabla, con filtro por estado: operativa / en mantención / fuera de servicio).

Ficha de detalle por máquina que muestre:

Datos generales (nombre, código interno, marca, modelo, ubicación, año, foto).

Fecha de última mantención.

Fecha de próxima mantención (calculada o ingresada manualmente).

Estado actual y alerta visual (badge de color) si la próxima mantención está vencida o próxima a vencer (ej: menos de 7 días).

Historial de mantenciones realizadas a esa máquina (lista cronológica).

B. Inventario / Repuestos

Listado de insumos y repuestos (ej: rodamientos, filtros, aceites) con: nombre, código, stock actual, stock mínimo, unidad de medida, costo unitario, proveedor.

Alerta visual cuando el stock esté por debajo del mínimo.

CRUD completo (crear, editar, eliminar, ajustar stock manualmente) para rol Admin.

Los repuestos deben poder asociarse a una máquina y a una orden de trabajo, de modo que al usarse en una mantención se descuente automáticamente del stock.

C. Órdenes de trabajo / Mantenciones

Crear una orden de trabajo asociada a una máquina: tipo (preventiva/correctiva), fecha programada, técnico asignado, descripción.

Al ejecutar/cerrar la orden: registrar fecha real de ejecución, repuestos/insumos utilizados (descontando stock automáticamente), horas de mano de obra y observaciones.

Esto debe actualizar automáticamente en la ficha de la máquina la "fecha de última mantención" y recalcular la "próxima mantención" según una periodicidad configurable por máquina (ej: cada 30/60/90 días u horas de uso).

Vista de calendario o listado de próximas mantenciones programadas (útil para planificación).

D. Empleados

Ficha simple de empleados: nombre, cargo, área, fecha de ingreso, tarifa por hora (para calcular costo de mano de obra), sueldo base (visible solo para Admin/RRHH).

Asociar empleados como "técnico asignado" en las órdenes de trabajo.

E. Reportes y Costos

Reporte de costo por orden de trabajo: costo de insumos (suma de repuestos usados x costo unitario) + costo de mano de obra (horas x tarifa del técnico).

Reporte de costos por máquina en un rango de fechas (para saber cuánto cuesta mantener cada equipo).

Reporte de costos totales por período (mensual/anual), con gráfico simple de barras o líneas.

Reporte de sueldos totales por período (solo Admin/RRHH).

Exportar reportes a CSV/Excel si es posible.

4. Modelo de datos sugerido (tablas en Supabase)

usuarios (id, nombre, email, rol)

maquinas (id, nombre, codigo, marca, modelo, ubicacion, foto_url, estado, fecha_ultima_mantencion, fecha_proxima_mantencion, periodicidad_dias)

inventario (id, nombre, codigo, stock_actual, stock_minimo, unidad, costo_unitario, proveedor)

empleados (id, nombre, cargo, area, fecha_ingreso, tarifa_hora, sueldo_base)

ordenes_trabajo (id, maquina_id, tipo, fecha_programada, fecha_ejecucion, tecnico_id, estado, horas_mano_obra, observaciones)

orden_trabajo_insumos (id, orden_id, insumo_id, cantidad_usada, costo_al_momento)

Ajusta nombres y relaciones (foreign keys) según buenas prácticas de Postgres. Usa RLS para que cada rol solo pueda leer/escribir lo que le corresponde según el módulo.

5. Diseño / UX

Estilo limpio, corporativo, tipo dashboard (piensa en un ERP moderno, no algo genérico de plantilla).

Sidebar fijo con navegación por módulo (ícono + texto).

Uso de badges de color para estados (verde = operativo/al día, amarillo = próximo a vencer, rojo = vencido/fuera de servicio).

Tablas con búsqueda y filtros en cada módulo.

Formularios de creación/edición en modales o paneles laterales, no en páginas separadas, para mantener fluidez.

Dashboard inicial (home) con resumen: cantidad de máquinas operativas, mantenciones próximas a vencer, alertas de stock bajo, costo total del mes.

6. Consideraciones

La app es para un equipo pequeño (10-20 usuarios), así que prioriza simplicidad y velocidad de uso por sobre funcionalidades complejas o escalabilidad masiva.

Todo dato debe quedar persistido en Supabase, no en estado local, para que el equipo trabaje siempre con información actualizada y compartida.

Deja preparada la estructura para poder agregar más módulos a futuro (ej: proveedores, compras) sin rehacer el modelo de datos.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/25516398-a242-445b-859c-1df554f278be).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
