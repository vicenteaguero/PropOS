import { apiRequest } from "@shared/api/http";
import { qs } from "@shared/lib/query-string";

export interface GeoSuggestion {
  label: string;
  address: string;
  comuna: string | null;
  region: string | null;
  lat: number | null;
  lon: number | null;
}

export interface GeoAutocompleteResponse {
  items: GeoSuggestion[];
  /** OpenStreetMap's licence requires this on screen. */
  attribution: string;
}

export const geoApi = {
  autocomplete: (q: string, limit = 6) =>
    apiRequest<GeoAutocompleteResponse>(`/v1/geo/autocomplete${qs({ q, limit })}`),
};
