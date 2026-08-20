import { useEffect, useMemo, useRef } from "react";
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Property } from "../api/properties-api";

/**
 * Interactive property map.
 *
 * Deliberately the ONLY module in the feature that imports `maplibre-gl`: the
 * library is ~200KB gzip, so it is reached exclusively through a `React.lazy`
 * boundary and Rollup gives it a chunk of its own. Importing it anywhere else —
 * even for a type — would pull it back into the initial bundle.
 *
 * Tiles come from OpenFreeMap: no API key, no billing, no request quota.
 */

/** Santiago. Fallback centre when nothing in the page is geocoded. */
const FALLBACK_CENTER: [number, number] = [-70.6483, -33.4569];

const STYLE_URL = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
} as const;

// MapLibre parses its own colour strings and does not understand the oklch()
// values in our tokens, so the pin palette is stated literally. Both variants
// are picked to sit above the corresponding basemap.
const PALETTE = {
  dark: {
    pin: "#fafafa",
    pinActive: "#ffffff",
    onPin: "#0a0a0a",
    halo: "#0a0a0a",
  },
  light: {
    pin: "#171717",
    pinActive: "#000000",
    onPin: "#ffffff",
    halo: "#ffffff",
  },
} as const;

const SOURCE_ID = "properties";
const PIN_LAYERS = ["pin-dot", "pin-price", "clusters"] as const;

interface PinFeature {
  type: "Feature";
  id: number;
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { propertyId: string; label: string };
}

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

/** Short pin label: "$120M", "$450K". Full precision does not fit on a pin. */
function pinLabel(cents: number | null): string {
  if (cents == null) return "—";
  const clp = cents / 100;
  if (clp >= 1_000_000) {
    const millions = clp / 1_000_000;
    return `$${millions >= 100 ? Math.round(millions) : millions.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (clp >= 1_000) return `$${Math.round(clp / 1_000)}K`;
  return `$${Math.round(clp)}`;
}

export interface PropertyMapProps {
  properties: Property[];
  /** Row the side list is hovering; its pin is highlighted. */
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  /**
   * Ids inside the current viewport, emitted on every `moveend`. This is what
   * makes the map the query rather than a picture of a list built elsewhere.
   */
  onVisibleChange: (ids: string[]) => void;
  className?: string;
}

export default function PropertyMap({
  properties,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
  onVisibleChange,
  className,
}: PropertyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const fittedRef = useRef(false);
  const hoveredFeatureRef = useRef<number | null>(null);
  // Feature ids must be numeric for `setFeatureState`, so index ↔ property id
  // is kept on the side rather than parsed out of the uuid.
  const idByIndexRef = useRef<string[]>([]);
  const indexByIdRef = useRef<Record<string, number>>({});

  // Callbacks and data live in refs so the map is built exactly once:
  // re-creating it on every parent render would restart the tile download and
  // throw away the viewport the user just panned to.
  const handlersRef = useRef({ onHover, onSelect, onVisibleChange });
  handlersRef.current = { onHover, onSelect, onVisibleChange };

  const geojson = useMemo(() => {
    const features: PinFeature[] = properties
      .filter((p) => p.lat != null && p.lng != null)
      .map((p, index) => ({
        type: "Feature",
        id: index,
        geometry: { type: "Point", coordinates: [p.lng as number, p.lat as number] },
        properties: { propertyId: p.id, label: pinLabel(p.list_price_cents) },
      }));
    idByIndexRef.current = features.map((f) => f.properties.propertyId);
    indexByIdRef.current = Object.fromEntries(idByIndexRef.current.map((id, i) => [id, i]));
    return { type: "FeatureCollection" as const, features };
  }, [properties]);

  const geojsonRef = useRef(geojson);
  geojsonRef.current = geojson;

  // --- build once -----------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL[isDark() ? "dark" : "light"],
      center: FALLBACK_CENTER,
      zoom: 10,
      // Compact AND collapsed: the expanded OpenStreetMap credit ran the width
      // of the map on a phone. Compact alone still renders it open on first
      // paint; `compact: true` with the control added manually below lets it
      // start as the small (i) button it is meant to be.
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    /** (Re)install source + layers. Runs on load and after every theme swap,
     * because `setStyle` discards everything we added to the previous style. */
    const install = () => {
      if (map.getSource(SOURCE_ID)) return;
      const theme = PALETTE[isDark() ? "dark" : "light"];
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: geojsonRef.current,
        cluster: true,
        clusterRadius: 55,
        clusterMaxZoom: 14,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": theme.pin,
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 21, 50, 27],
          "circle-stroke-width": 2,
          "circle-stroke-color": theme.halo,
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
        paint: { "text-color": theme.onPin },
      });
      map.addLayer({
        id: "pin-dot",
        type: "circle",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "case",
            ["boolean", ["feature-state", "active"], false],
            theme.pinActive,
            theme.pin,
          ],
          "circle-radius": ["case", ["boolean", ["feature-state", "active"], false], 10, 6],
          "circle-stroke-width": 2,
          "circle-stroke-color": theme.halo,
        },
      });
      map.addLayer({
        id: "pin-price",
        type: "symbol",
        source: SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        layout: {
          "text-field": ["get", "label"],
          "text-size": 12,
          "text-offset": [0, -1.5],
          "text-padding": 3,
        },
        paint: { "text-color": theme.pin, "text-halo-color": theme.halo, "text-halo-width": 1.5 },
      });
    };

    map.on("load", install);
    map.on("styledata", install);

    for (const layer of PIN_LAYERS) {
      map.on("mouseenter", layer, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = "";
      });
    }

    map.on("mousemove", "pin-dot", (event) => {
      const feature = event.features?.[0];
      if (!feature || typeof feature.id !== "number") return;
      if (hoveredFeatureRef.current === feature.id) return;
      hoveredFeatureRef.current = feature.id;
      handlersRef.current.onHover(idByIndexRef.current[feature.id] ?? null);
    });
    map.on("mouseleave", "pin-dot", () => {
      hoveredFeatureRef.current = null;
      handlersRef.current.onHover(null);
    });

    const open = (event: maplibregl.MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.propertyId;
      if (typeof id === "string") handlersRef.current.onSelect(id);
    };
    map.on("click", "pin-dot", open);
    map.on("click", "pin-price", open);

    map.on("click", "clusters", (event) => {
      const feature = event.features?.[0];
      const clusterId = feature?.properties?.cluster_id;
      if (feature == null || clusterId == null) return;
      const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      const center = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
      void source?.getClusterExpansionZoom(clusterId).then((zoom) => map.easeTo({ center, zoom }));
    });

    map.on("moveend", () => {
      const bounds = map.getBounds();
      handlersRef.current.onVisibleChange(
        geojsonRef.current.features
          .filter((f) => bounds.contains(f.geometry.coordinates))
          .map((f) => f.properties.propertyId),
      );
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // --- data ----------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    // No source yet means the style is still loading; `install` reads the ref,
    // so the current data lands the moment it runs.
    if (!source) return;
    source.setData(geojson);

    // Frame the portfolio on first load only. Refitting on every search
    // keystroke would yank the viewport out from under the user.
    if (!fittedRef.current && geojson.features.length > 0) {
      fittedRef.current = true;
      const bounds = new maplibregl.LngLatBounds();
      for (const feature of geojson.features) bounds.extend(feature.geometry.coordinates);
      map.fitBounds(bounds, { padding: 64, maxZoom: 15, duration: 0 });
    }
  }, [geojson]);

  // --- hover / selection sync ----------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource(SOURCE_ID)) return;
    const active = new Set(
      [hoveredId, selectedId]
        .filter((id): id is string => !!id)
        .map((id) => indexByIdRef.current[id]),
    );
    for (let index = 0; index < idByIndexRef.current.length; index += 1) {
      map.setFeatureState({ source: SOURCE_ID, id: index }, { active: active.has(index) });
    }
  }, [hoveredId, selectedId, geojson]);

  // --- theme ---------------------------------------------------------------
  useEffect(() => {
    const observer = new MutationObserver(() => {
      mapRef.current?.setStyle(STYLE_URL[isDark() ? "dark" : "light"]);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return <div ref={containerRef} className={className} />;
}
