import { useState } from "react";
import { describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
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
    <button
      type="button"
      onClick={() => {
        navigate("/destino?tab=x", { replace: true });
        onDismiss();
      }}
    >
      ir
    </button>
  );
}

/**
 * The sheet lives OUTSIDE the routed subtree, exactly like MobileBottomNav does
 * in AppLayout — otherwise navigating unmounts the hook's host mid-flight and
 * its refs stop tracking the location.
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

describe("useDismissOnBack", () => {
  it("does not undo a navigation made from inside the overlay", async () => {
    // The regression: the cleanup popped the history entry it had pushed, which
    // landed one tick AFTER the navigation and sent the user straight back. Every
    // item in the mobile "Más" sheet looked like it did nothing at all.
    render(
      <MemoryRouter initialEntries={["/origen"]}>
        <Harness />
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole("button", { name: "ir" }));
    // Let the deferred cleanup pop run (setTimeout 0).
    await act(() => new Promise((r) => setTimeout(r, 10)));

    expect(screen.getByTestId("url").textContent).toBe("/destino?tab=x");
  });
});
