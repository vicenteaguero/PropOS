import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@features/documents/api/http";
import type { PropertyGrant } from "@shared/types/auth";

interface ApiGrant {
  id: string;
  user_id: string;
  property_id: string;
  tenant_id: string;
  view: PropertyGrant["view"];
  capabilities: string[];
  property_title: string | null;
  property_address: string | null;
  granted_by: string | null;
}

function mapGrant(r: ApiGrant): PropertyGrant {
  return {
    id: r.id,
    userId: r.user_id,
    propertyId: r.property_id,
    tenantId: r.tenant_id,
    view: r.view,
    capabilities: r.capabilities ?? [],
    propertyTitle: r.property_title,
    propertyAddress: r.property_address,
    grantedBy: r.granted_by,
  };
}

export function useMyGrants() {
  return useQuery({
    queryKey: ["grants", "me"],
    queryFn: async () => {
      const data = await apiRequest<ApiGrant[]>("/v1/grants/me");
      return data.map(mapGrant);
    },
  });
}

export function useGrantForProperty(propertyId: string | undefined) {
  const { data, ...rest } = useMyGrants();
  const grant = data?.find((g) => g.propertyId === propertyId);
  return { grant, ...rest };
}
