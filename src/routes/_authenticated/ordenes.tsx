import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/erp/AppShell";
import {
  Tarjeta,
  Buscador,
  BotonPrincipal,
  BotonSecundario,
  Campo,
  Entrada,
  Seleccion,
  AreaTexto,
  PanelLateral,
  EstadoOrden,
  Pastilla,
  Vacio,
  TituloSeccion,
} from "@/components/erp/ui-bits";
import { useMaquinas, useEmpleados, useInventario, useOrdenes, costoOrden, type OrdenCompleta } from "@/lib/datos";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fecha, money, hoyISO } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/ordenes")({
  head: () => ({
    meta: [
      { title: "Órdenes de trabajo · FERRUM" },
      { name: "description", content: "Crea, programa y cierra órdenes de mantención con consumo de repuestos y horas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { property: "og:title", content: "Órdenes de trabajo · FERRUM" },
      { property: "og:description", content: "Mantenciones preventivas y correctivas con costos por orden." },
    ],
  }),
  component: Ordenes,
});

const nuevaVacia = {
  maquina_id: "",
  tipo: "preventiva",
  fecha_programada: hoyISO(),
  tecnico_id: "",
  descripcion: "",
};

function Ordenes() {
  const { esAdmin, esTecnico } = useAuth();
  const puedeEditar = esAdmin || esTecnico;
  const { data: ordenes = [], isLoading } = useOrdenes();
  const { data: maquinas = [] } = useMaquinas();
  const { data: empleados = [] } = useEmpleados();
  const { data: insumos = [] } = useInventario();
  const qc = useQueryClient();

  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState("todas");
  const [nueva, setNueva] = useState<typeof nuevaVacia | null>(null);
  const [cierre, setCierre] = useState<OrdenCompleta | null>(null);
  const [cierreForm, setCierreForm] = useState({ fecha_ejecucion: hoyISO(), horas: "0", observaciones: "" });
  const [consumos, setConsumos] = useState<{ insumo_id: string; cantidad: string }[]>([]);

  const lista = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    return ordenes.filter(
      (o) =>
        (filtro === "todas" || o.estado === filtro) &&
        (!t ||
          String(o.folio).includes(t) ||
          (o.maquinas?.nombre ?? "").toLowerCase().includes(t) ||
          (o.empleados?.nombre ?? "").toLowerCase().includes(t)),
    );
  }, [ordenes, busqueda, filtro]);

  const crear = useMutation({
    mutationFn: async () => {
      if (!nueva) return;
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("ordenes_trabajo").insert({
        maquina_id: nueva.maquina_id,
        tipo: nueva.tipo as "preventiva",
        fecha_programada: nueva.fecha_programada,
        tecnico_id: nueva.tecnico_id || null,
        descripcion: nueva.descripcion || null,
        creado_por: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordenes"] });
      setNueva(null);
      toast.success("Orden creada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: "en_proceso" | "cancelada" | "pendiente" }) => {
      const { error } = await supabase.from("ordenes_trabajo").update({ estado }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordenes"] });
      qc.invalidateQueries({ queryKey: ["maquinas"] });
      toast.success("Orden actualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cerrarOrden = useMutation({
    mutationFn: async () => {
      if (!cierre) return;
      const filas = consumos
        .filter((c) => c.insumo_id && Number(c.cantidad) > 0)
        .map((c) => ({ orden_id: cierre.id, insumo_id: c.insumo_id, cantidad_usada: Number(c.cantidad) }));
      if (filas.length) {
        const { error } = await supabase.from("orden_trabajo_insumos").insert(filas);
        if (error) throw error;
      }
      const { error } = await supabase
        .from("ordenes_trabajo")
        .update({
          estado: "completada",
          fecha_ejecucion: cierreForm.fecha_ejecucion,
          horas_mano_obra: Number(cierreForm.horas || 0),
          observaciones: cierreForm.observaciones || null,
        })
        .eq("id", cierre.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ordenes"] });
      qc.invalidateQueries({ queryKey: ["maquinas"] });
      qc.invalidateQueries({ queryKey: ["inventario"] });
      setCierre(null);
      toast.success("Orden cerrada: stock y fechas de mantención actualizados");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function abrirCierre(o: OrdenCompleta) {
    setCierre(o);
    setCierreForm({ fecha_ejecucion: hoyISO(), horas: String(o.horas_mano_obra ?? 0), observaciones: o.observaciones ?? "" });
    setConsumos([]);
  }

  const totalCierre =
    consumos.reduce((s, c) => {
      const ins = insumos.find((i) => i.id === c.insumo_id);
      return s + Number(c.cantidad || 0) * Number(ins?.costo_unitario ?? 0);
    }, 0) +
    Number(cierreForm.horas || 0) *
      Number(empleados.find((e) => e.id === cierre?.tecnico_id)?.tarifa_hora ?? 0);

  return (
    <AppShell
      titulo="Órdenes de trabajo"
      subtitulo={`${ordenes.filter((o) => o.estado === "pendiente").length} pendientes de ejecución`}
      acciones={
        <>
          <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Folio, equipo o técnico…" />
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="h-8 rounded-lg bg-base px-2 text-xs ring-1 ring-line focus:outline-none"
          >
            <option value="todas">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_proceso">En proceso</option>
            <option value="completada">Completada</option>
            <option value="cancelada">Cancelada</option>
          </select>
          {puedeEditar ? <BotonPrincipal onClick={() => setNueva({ ...nuevaVacia })}>Nueva orden</BotonPrincipal> : null}
        </>
      }
    >
      <Tarjeta className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-line text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="px-5 py-3 font-normal">Folio</th>
              <th className="px-5 py-3 font-normal">Equipo</th>
              <th className="px-5 py-3 font-normal">Tipo</th>
              <th className="px-5 py-3 font-normal">Programada</th>
              <th className="px-5 py-3 font-normal">Técnico</th>
              <th className="px-5 py-3 font-normal">Estado</th>
              <th className="px-5 py-3 font-normal">Costo</th>
              <th className="px-5 py-3 font-normal" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {lista.map((o) => (
              <tr key={o.id} className="hover:bg-base/60">
                <td className="px-5 py-3 font-mono text-xs text-muted-foreground">#{o.folio}</td>
                <td className="px-5 py-3">
                  <div className="font-medium">{o.maquinas?.nombre ?? "—"}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{o.maquinas?.codigo ?? ""}</div>
                </td>
                <td className="px-5 py-3">
                  <Pastilla tono={o.tipo === "preventiva" ? "ok" : "clay"}>
                    {o.tipo === "preventiva" ? "Preventiva" : "Correctiva"}
                  </Pastilla>
                </td>
                <td className="px-5 py-3 text-muted-foreground">{fecha(o.fecha_programada)}</td>
                <td className="px-5 py-3 text-muted-foreground">{o.empleados?.nombre ?? "Sin asignar"}</td>
                <td className="px-5 py-3"><EstadoOrden estado={o.estado} /></td>
                <td className="px-5 py-3">{money(costoOrden(o).total)}</td>
                <td className="px-5 py-3 text-right">
                  {puedeEditar && o.estado !== "completada" && o.estado !== "cancelada" ? (
                    <div className="flex justify-end gap-3">
                      {o.estado === "pendiente" ? (
                        <button
                          onClick={() => cambiarEstado.mutate({ id: o.id, estado: "en_proceso" })}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          Iniciar
                        </button>
                      ) : null}
                      <button onClick={() => abrirCierre(o)} className="text-xs text-accent hover:underline">
                        Cerrar
                      </button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && lista.length === 0 ? <Vacio mensaje="Sin órdenes para este filtro." /> : null}
      </Tarjeta>

      <PanelLateral
        abierto={nueva !== null}
        titulo="Nueva orden de trabajo"
        subtitulo="Programación de mantención"
        onCerrar={() => setNueva(null)}
        pie={
          <BotonPrincipal
            className="w-full"
            disabled={crear.isPending || !nueva?.maquina_id}
            onClick={() => crear.mutate()}
          >
            Crear orden
          </BotonPrincipal>
        }
      >
        {nueva ? (
          <>
            <Campo label="Máquina">
              <Seleccion value={nueva.maquina_id} onChange={(e) => setNueva({ ...nueva, maquina_id: e.target.value })}>
                <option value="">Selecciona un equipo</option>
                {maquinas.map((m) => (
                  <option key={m.id} value={m.id}>{m.codigo} · {m.nombre}</option>
                ))}
              </Seleccion>
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Tipo">
                <Seleccion value={nueva.tipo} onChange={(e) => setNueva({ ...nueva, tipo: e.target.value })}>
                  <option value="preventiva">Preventiva</option>
                  <option value="correctiva">Correctiva</option>
                </Seleccion>
              </Campo>
              <Campo label="Fecha programada">
                <Entrada
                  type="date"
                  value={nueva.fecha_programada}
                  onChange={(e) => setNueva({ ...nueva, fecha_programada: e.target.value })}
                />
              </Campo>
            </div>
            <Campo label="Técnico asignado">
              <Seleccion value={nueva.tecnico_id} onChange={(e) => setNueva({ ...nueva, tecnico_id: e.target.value })}>
                <option value="">Sin asignar</option>
                {empleados.map((e) => (
                  <option key={e.id} value={e.id}>{e.nombre} — {e.cargo ?? "—"}</option>
                ))}
              </Seleccion>
            </Campo>
            <Campo label="Descripción del trabajo">
              <AreaTexto rows={4} value={nueva.descripcion} onChange={(e) => setNueva({ ...nueva, descripcion: e.target.value })} />
            </Campo>
          </>
        ) : null}
      </PanelLateral>

      <PanelLateral
        abierto={cierre !== null}
        titulo={cierre ? `Cerrar orden #${cierre.folio}` : ""}
        subtitulo={cierre?.maquinas?.nombre ?? ""}
        onCerrar={() => setCierre(null)}
        pie={
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Costo estimado</span>
              <span className="font-medium">{money(totalCierre)}</span>
            </div>
            <div className="flex gap-2">
              <BotonPrincipal className="flex-1" disabled={cerrarOrden.isPending} onClick={() => cerrarOrden.mutate()}>
                Cerrar orden
              </BotonPrincipal>
              {cierre && esAdmin ? (
                <BotonSecundario
                  onClick={() => {
                    cambiarEstado.mutate({ id: cierre.id, estado: "cancelada" });
                    setCierre(null);
                  }}
                >
                  Cancelar orden
                </BotonSecundario>
              ) : null}
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Fecha de ejecución">
            <Entrada
              type="date"
              value={cierreForm.fecha_ejecucion}
              onChange={(e) => setCierreForm({ ...cierreForm, fecha_ejecucion: e.target.value })}
            />
          </Campo>
          <Campo label="Horas de mano de obra">
            <Entrada
              type="number"
              step="0.5"
              value={cierreForm.horas}
              onChange={(e) => setCierreForm({ ...cierreForm, horas: e.target.value })}
            />
          </Campo>
        </div>

        <div>
          <TituloSeccion>Repuestos utilizados</TituloSeccion>
          <p className="mt-1 text-[11px] text-muted-foreground">Se descuentan del stock al cerrar la orden.</p>
          <div className="mt-3 space-y-2">
            {consumos.map((c, idx) => (
              <div key={idx} className="flex gap-2">
                <Seleccion
                  value={c.insumo_id}
                  onChange={(e) => {
                    const copia = [...consumos];
                    copia[idx] = { ...c, insumo_id: e.target.value };
                    setConsumos(copia);
                  }}
                  className="flex-1"
                >
                  <option value="">Selecciona repuesto</option>
                  {insumos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.codigo} · {i.nombre} ({Number(i.stock_actual)} {i.unidad})
                    </option>
                  ))}
                </Seleccion>
                <Entrada
                  type="number"
                  className="w-24"
                  value={c.cantidad}
                  onChange={(e) => {
                    const copia = [...consumos];
                    copia[idx] = { ...c, cantidad: e.target.value };
                    setConsumos(copia);
                  }}
                />
                <button
                  onClick={() => setConsumos(consumos.filter((_, i) => i !== idx))}
                  className="shrink-0 px-1 text-xs text-muted-foreground hover:text-red"
                  aria-label="Quitar repuesto"
                >
                  ✕
                </button>
              </div>
            ))}
            <BotonSecundario onClick={() => setConsumos([...consumos, { insumo_id: "", cantidad: "1" }])}>
              Agregar repuesto
            </BotonSecundario>
          </div>
        </div>

        <Campo label="Observaciones">
          <AreaTexto
            rows={4}
            value={cierreForm.observaciones}
            onChange={(e) => setCierreForm({ ...cierreForm, observaciones: e.target.value })}
          />
        </Campo>
      </PanelLateral>
    </AppShell>
  );
}
