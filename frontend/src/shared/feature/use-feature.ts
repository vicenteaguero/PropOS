import { useAuth } from "@shared/hooks/use-auth";
import {
  entryFor,
  wipNoteFor,
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
  /**
   * True when the UI should actually DRAW the unfinished marker.
   *
   * `wip` is a message to the broker, not to us: a dev admin is the person who
   * set the state, sees it on the switchboard, and would otherwise carry a
   * badge on half the app for no information. So the state stays `wip` for
   * everyone -- nothing is gated differently -- and only the chrome is dropped
   * for the dev admin.
   */
  showWip: boolean;
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
  const { features, user } = useAuth();
  const entry = entryFor(features, key);
  const isWip = entry.state === "wip";
  return {
    ...entry,
    // A `wip` feature with no tenant note still has something to say.
    note: isWip ? wipNoteFor(features, key) : entry.note,
    visible: computeVisible(features, key),
    enabled: computeEnabled(features, key),
    isWip,
    showWip: isWip && !user?.isDevAdmin,
  };
}
