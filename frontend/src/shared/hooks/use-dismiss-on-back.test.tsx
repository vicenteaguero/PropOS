import { useState } from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useDismissOnBack } from "./use-dismiss-on-back";

function Probe() {
  const location = useLocation();
  return <div data-testid="url">{`${location.pathname}${location.search}`}</div>;
}

/**
 * Stands in for BottomSheet: the hook's host stays mounted and only its content
 * comes and goes, which is how the real sheet behaves (MobileBottomNav renders
 * <BottomSheet> unconditionally and hands it `open`).
 */
function Overlay({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  const navigate = useNavigate();
  useDismissOnBack(open, onDismiss);
  if (!open) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          navigate("/destino?tab=x", { replace: true });
          onDismiss();
        }}
      >
        ir
      </button>
      <button type="button" onClick={onDismiss}>
        cerrar
      </button>
    </>
  );
}

/**
 * The sheet lives OUTSIDE the routed subtree, exactly like MobileBottomNav does
 * in AppLayout — otherwise navigating unmounts the hook's host mid-flight and
 * its refs stop tracking the location.
 *
 * BrowserRouter, not MemoryRouter: this hook exists to reconcile React state
 * with the real history stack, and React Router 7 puts navigation inside
 * `startTransition`. A memory history has neither, so it cannot reproduce the
 * bug either version of this test was written for — the first one passed
 * against code that was broken in every real browser.
 */
function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Routes>
        <Route path="/origen" element={<Probe />} />
        <Route path="/destino" element={<Probe />} />
      </Routes>
      <Overlay open={open} onDismiss={() => setOpen(false)} />
    </>
  );
}

/** Long enough for the deferred cleanup pop (setTimeout 0) and a popstate. */
const settle = () => act(() => new Promise((r) => setTimeout(r, 30)));

describe("useDismissOnBack", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/origen");
  });

  it("does not undo a navigation made from inside the overlay", async () => {
    // The regression: the cleanup popped the history entry it had pushed, which
    // landed one tick AFTER the navigation and sent the user straight back. Every
    // item in the mobile "Más" sheet looked like it did nothing at all.
    render(
      <BrowserRouter>
        <Harness />
      </BrowserRouter>,
    );
    await settle();

    await userEvent.click(screen.getByRole("button", { name: "ir" }));
    await settle();

    expect(screen.getByTestId("url").textContent).toBe("/destino?tab=x");
  });

  it("pops its own entry when the overlay is closed in place", async () => {
    // The other half of the contract: closing by button must leave the stack as
    // it found it, or the next Back is spent undoing an entry the user never saw.
    render(
      <BrowserRouter>
        <Harness />
      </BrowserRouter>,
    );
    await settle();
    const depth = window.history.length;

    await userEvent.click(screen.getByRole("button", { name: "cerrar" }));
    await settle();

    expect(window.history.length).toBe(depth);
    expect(screen.getByTestId("url").textContent).toBe("/origen");
  });
});
