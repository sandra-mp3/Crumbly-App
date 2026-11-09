export type Role = "CUSTOMER" | "BAKER_OWNER" | "BAKER_MANAGER" | "BAKER_STAFF" | "DELIVERY_PERSON" | "ADMIN";
export interface Actor { uid: string | null; role: Role | "GUEST"; bakeryId: string | null }
export class HttpError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status; } }
