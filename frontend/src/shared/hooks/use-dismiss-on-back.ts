import { useEffect, useId, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Makes the system Back gesture dismiss an overlay instead of leaving the page.
 *
 * A full-screen surface opened from React state — the Propo overlay, a bottom
 * sheet — is invisible to history. On Android, Back is the primary way out of
 * anything full-screen, so a broker who swiped back lost the whole screen and
 * whatever they had typed. iOS has the same problem with the edge swipe in a
 * standalone PWA.
 *
 * Implemented through the router, not through `history` directly. A raw
 * `history.pushState` desynchronises React Router's internal index: the router
 * does not know about the entry, so the next popstate makes it "correct" the
 * location and the user lands on a page they never asked for. The first version
 * of this hook did exactly that — Back closed the overlay and *also* jumped two
 * routes back, with `history.length` growing instead of shrinking.
 *
 * So: push a router entry for the same URL carrying a marker in location state.
 * While that marker is current, the overlay owns the top of the stack. Back pops
 * it, the marker disappears, and the overlay closes. Closing by button pops the
 * same entry so the stack is left as we found it.
 */
export function useDismissOnBack(open: boolean, onDismiss: () => void): void {
  const navigate = useNavigate();
  const location = useLocation();

  // Stable per hook instance, so nested overlays don't claim each other's entry.
  const marker = useId();

  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // True once our entry is on the stack and still current.
  const ownsEntryRef = useRef(false);

  // A pending cleanup pop. StrictMode runs effect → cleanup → effect in one go,
  // so popping synchronously in cleanup would undo the entry the re-run is
  // about to depend on and the overlay would close the instant it opened.
  // Deferring lets the re-run cancel it; a real unmount lets it through.
  const pendingPopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The URL our entry was pushed for. The cleanup pop is only correct while we
  // are still ON that URL: if the overlay closed *because* something inside it
  // navigated away, our entry is no longer on top and popping would undo that
  // navigation instead. That is exactly what happened to every item in the "Más"
  // sheet — tapping Propiedades navigated and was silently sent back one tick
  // later, so the whole sheet looked dead.
  const ownedUrlRef = useRef<string | null>(null);

  // Updated on every render, so the deferred cleanup can tell "closed in place"
  // from "closed because we navigated".
  const liveUrlRef = useRef("");
  liveUrlRef.current = `${location.pathname}${location.search}`;

  useEffect(() => {
    if (!open) return;

    if (pendingPopRef.current !== null) {
      clearTimeout(pendingPopRef.current);
      pendingPopRef.current = null;
      ownsEntryRef.current = true;
    } else {
      const url = `${location.pathname}${location.search}`;
      navigate(url, {
        state: { ...((location.state as Record<string, unknown> | null) ?? {}), __overlay: marker },
      });
      ownedUrlRef.current = url;
      ownsEntryRef.current = true;
    }

    return () => {
      // Dismissed by a button or Escape rather than by Back: our entry is still
      // on top, so take it back off. Without this the next Back would be spent
      // silently undoing an entry the user never saw, which reads as the
      // gesture being broken.
      if (!ownsEntryRef.current) return;
      pendingPopRef.current = setTimeout(() => {
        pendingPopRef.current = null;
        ownsEntryRef.current = false;
        // Compare against the LIVE url, not the one this closure captured at open
        // time. `useLocation` re-renders the host on every navigation, so the ref
        // is current even though the effect's own `location` is a render behind.
        if (liveUrlRef.current !== ownedUrlRef.current) {
          ownedUrlRef.current = null;
          return;
        }
        ownedUrlRef.current = null;
        navigate(-1);
      }, 0);
    };
    // `location` is intentionally read once, at open time: re-running on every
    // location change would push a second entry for the same overlay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, marker, navigate]);

  // Whether our marker has actually appeared in the location yet. `navigate`
  // lands a render later, so on the first pass the marker is legitimately
  // absent — treating that as "Back was pressed" closed the overlay the instant
  // it opened.
  const sawMarkerRef = useRef(false);

  // Back popped our entry — the marker we had is gone, so the overlay goes too.
  useEffect(() => {
    if (!open || !ownsEntryRef.current) return;
    const state = location.state as { __overlay?: string } | null;
    if (state?.__overlay === marker) {
      sawMarkerRef.current = true;
      return;
    }
    if (!sawMarkerRef.current) return; // the push has not landed yet
    ownsEntryRef.current = false;
    sawMarkerRef.current = false;
    onDismissRef.current();
  }, [open, location, marker]);
}
