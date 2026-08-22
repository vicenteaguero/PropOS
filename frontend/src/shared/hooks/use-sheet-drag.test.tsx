import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";
import { useSheetDrag } from "./use-sheet-drag";

/** Stands in for SheetContent: a scrolling box wearing the gesture. */
function Sheet({ onDismiss, scrollTop = 0 }: { onDismiss: () => void; scrollTop?: number }) {
  const drag = useSheetDrag(onDismiss);
  return (
    <div
      data-testid="sheet"
      ref={(el) => {
        if (el) Object.defineProperty(el, "scrollTop", { value: scrollTop, writable: true });
      }}
      style={drag.style}
      {...drag.handlers}
    >
      contenido
    </div>
  );
}

const touch = (y: number, x = 0) => ({ touches: [{ clientX: x, clientY: y }] });

describe("useSheetDrag", () => {
  it("dismisses when the sheet is dragged past the threshold", () => {
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} />);
    const el = screen.getByTestId("sheet");

    fireEvent.touchStart(el, touch(100));
    fireEvent.touchMove(el, touch(140));
    fireEvent.touchMove(el, touch(260));
    act(() => void fireEvent.touchEnd(el));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("springs back when the drag is short, and never trusts a zero-duration flick", () => {
    // The events below carry the same timestamp, which is what a coalesced pair
    // looks like. Dividing travel by zero elapsed time made a 50px nudge read
    // as an infinite-velocity flick and closed the sheet under the finger.
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} />);
    const el = screen.getByTestId("sheet");

    fireEvent.touchStart(el, touch(100));
    fireEvent.touchMove(el, touch(130));
    fireEvent.touchMove(el, touch(150));
    act(() => void fireEvent.touchEnd(el));

    expect(onDismiss).not.toHaveBeenCalled();
    // And it must let go of the finger, not stay translated.
    expect(el.style.transform).toBe("");
  });

  it("leaves the gesture alone when the sheet is scrolled", () => {
    // The trap this hook exists to avoid: the content is `overflow-y-auto`, so
    // dragging down and scrolling up are the same finger movement. Mid-scroll,
    // the sheet must not move at all.
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} scrollTop={220} />);
    const el = screen.getByTestId("sheet");

    fireEvent.touchStart(el, touch(100));
    fireEvent.touchMove(el, touch(180));
    fireEvent.touchMove(el, touch(400));
    act(() => void fireEvent.touchEnd(el));

    expect(onDismiss).not.toHaveBeenCalled();
    expect(el.style.transform).toBe("");
  });

  it("does not claim a horizontal swipe", () => {
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} />);
    const el = screen.getByTestId("sheet");

    fireEvent.touchStart(el, touch(100, 0));
    fireEvent.touchMove(el, touch(112, 90));
    fireEvent.touchMove(el, touch(130, 300));
    act(() => void fireEvent.touchEnd(el));

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
