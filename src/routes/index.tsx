import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({ meta: [
    { title: "FERRUM · Gestión de maquinaria y mantenimiento" },
    { name: "description", content: "Accede a FERRUM para consultar maquinaria, mantenciones, inventario y órdenes de trabajo." },
    { property: "og:title", content: "FERRUM · Gestión de maquinaria y mantenimiento" },
    { property: "og:description", content: "Gestión de maquinaria industrial y mantenimiento para tu equipo." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/panel" });
  },
  component: () => null,
});
