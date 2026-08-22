import { useAuth } from "@shared/hooks/use-auth";
import {
  entryFor,
  isEnabled as computeEnabled,
  isVisible as computeVisible,
  type FeatureEntry,
  type FeatureState,
} from "@shared/feature/catalog";

export interface FeatureVerdict extends FeatureEntry {
  state: FeatureState;
  /** Draw it at all? False only for `hidden`. */
  visible: boolean;
  /** Let it be used? False for `locked` (and for `hidden`, which never renders). */
  enabled: boolean;
  /** True for `wip`: usable, but the UI has to say it is unfinished. */
  isWip: boolean;
  note: string | null;
}

/**
 * One feature's state for the active tenant.
 *
 * Read-only and synchronous: the map arrives with the session (see `use-auth`),
 * so a component never has to handle a loading state for it. A key that is not
 * in the map answers `on`.
 */
export function useFeature(key?: string): FeatureVerdict {
  const { features } = useAuth();
  const entry = entryFor(features, key);
  return {
    ...entry,
    visible: computeVisible(features, key),
    enabled: computeEnabled(features, key),
    isWip: entry.state === "wip",
  };
}
