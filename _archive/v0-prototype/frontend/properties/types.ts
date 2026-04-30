export type PropertyStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "INACTIVE";

export interface Property {
  id: string;
  title: string;
  description: string | null;
  status: PropertyStatus;
  address: string | null;
  surfaceM2: number | null;
  tenantId: string;
  landownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePropertyPayload {
  title: string;
  description: string | null;
  status: PropertyStatus;
  address: string | null;
  surfaceM2: number | null;
}

export interface UpdatePropertyPayload extends Partial<CreatePropertyPayload> {
  id: string;
}
