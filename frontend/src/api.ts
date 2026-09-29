export interface Reservation {
  id: number;
  customerName: string;
  email: string;
  room: string;
  date: string;
  startTime: string;
  endTime: string;
  participants: number;
  status: 'confirmed' | 'cancelled';
  createdAt: string;
}

export type NewReservation = Omit<Reservation, 'id' | 'status' | 'createdAt'>;

export interface Room {
  name: string;
  capacity: number;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? `Erreur HTTP ${res.status}`, body.details);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  listReservations: () => request<Reservation[]>('/api/reservations'),
  listRooms: () => request<Room[]>('/api/rooms'),
  createReservation: (input: NewReservation) =>
    request<Reservation>('/api/reservations', { method: 'POST', body: JSON.stringify(input) }),
  cancelReservation: (id: number) => request<void>(`/api/reservations/${id}`, { method: 'DELETE' }),
  apiVersion: () => request<{ version: string; commit: string }>('/version'),
  // Servi par nginx à partir de APP_VERSION (ou par public/config.json en local)
  frontendConfig: () => request<{ version: string }>('/config.json', { cache: 'no-store' }),
};
