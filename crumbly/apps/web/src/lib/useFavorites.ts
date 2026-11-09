import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { api } from "./api";
import type { Product } from "../types";

export function useFavorites() {
  const { user, requireAuth } = useAuth(), qc = useQueryClient();
  const q = useQuery({ queryKey: ["favorites", user?.uid], enabled: !!user, queryFn: () => api<Product[]>("/favorites") });
  const ids = new Set((q.data ?? []).map((p) => p.id));
  const m = useMutation({ mutationFn: (v: { id: string; on: boolean }) => api(`/favorites/${v.id}`, { method: v.on ? "PUT" : "DELETE" }), onSettled: () => qc.invalidateQueries({ queryKey: ["favorites"] }) });
  return { list: q.data, loading: q.isLoading, has: (id: string) => ids.has(id), toggle: (id: string) => requireAuth("Sign in to save your favourites.", () => m.mutate({ id, on: !ids.has(id) })) };
}
