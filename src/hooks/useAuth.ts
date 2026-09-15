import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Rol = "admin" | "tecnico" | "rrhh";

export type Sesion = {
  userId: string;
  email: string;
  nombre: string;
  roles: Rol[];
};

export function useAuth() {
  const { data, isLoading } = useQuery<Sesion | null>({
    queryKey: ["sesion"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const [{ data: perfil }, { data: roles }] = await Promise.all([
        supabase.from("perfiles").select("nombre, email").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      return {
        userId: user.id,
        email: perfil?.email || user.email || "",
        nombre: perfil?.nombre || user.email?.split("@")[0] || "Usuario",
        roles: (roles ?? []).map((r) => r.role as Rol),
      };
    },
    staleTime: 60_000,
  });

  const roles = data?.roles ?? [];
  return {
    sesion: data ?? null,
    cargando: isLoading,
    esAdmin: roles.includes("admin"),
    esTecnico: roles.includes("tecnico"),
    esRRHH: roles.includes("rrhh"),
  };
}

export function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function etiquetaRol(rol?: Rol) {
  if (rol === "admin") return "Administrador";
  if (rol === "tecnico") return "Técnico";
  if (rol === "rrhh") return "RRHH / Administrativo";
  return "Sin rol";
}
