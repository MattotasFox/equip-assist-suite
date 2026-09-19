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
      { property: "og:title", content: "Órdenes de trabajo · FERRUM" },
      { property: "og:description", content: "Mantenciones preventivas y correctivas con costos por orden." },
    ],
  }),
  component: Ordenes;
});

function Ordenes() {
  return null;
}
