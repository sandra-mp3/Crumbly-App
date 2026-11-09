import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/AuthProvider";
import { api } from "./api";
export interface Me { uid: string; role: string; bakeryId: string | null }
export function useMe() { const { user } = useAuth(); return useQuery({ queryKey: ["me", user?.uid], enabled: !!user, queryFn: () => api<Me>("/me") }); }
export const isBaker = (m?: Me) => !!m?.bakeryId && m.role.startsWith("BAKER");
