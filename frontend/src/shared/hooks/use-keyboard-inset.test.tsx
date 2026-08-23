import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useKeyboardInset } from "./use-keyboard-inset";
import { __resetViewportStore } from "@shared/lib/viewport-store";

function installViewport() {
  const vv = Object.assign(new EventTarget(), {
    height: 844,
    offsetTop: 0,
    width: 390,
    scale: 1,
  });
  Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: 844, configurable: true, writable: true });
  return vv as EventTarget & { height: number; offsetTop: number };
}

function Surface({ id }: { id: string }) {
  const { open } = useKeyboardInset();
  return <span data-testid={id}>{open ? "open" : "closed"}</span>;
}

const varOf = (name: string) => document.documentElement.style.getPropertyValue(name);

let vv: ReturnType<typeof installViewport>;

beforeEach(() => {
  __resetViewportStore();
  vv = installViewport();
});

afterEach(() => __resetViewportStore());

describe("useKeyboardInset", () => {
  it("keeps working in a surviving surface after another unmounts", () => {
    // The production sequence: Propo open over a WhatsApp thread, Propo closes.
    // Every surface used to publish and then DELETE the shared css variables, so
    // the survivor's composer fell behind the keyboard the moment Propo closed.
    const both = render(
      <>
        <Surface id="thread" />
        <Surface id="propo" />
      </>,
    );
    expect(varOf("--vv-h")).toBe("844px");

    both.rerender(
      <>
        <Surface id="thread" />
      </>,
    );
    expect(varOf("--vv-h")).toBe("844px");

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    act(() => {
      vv.height = 508;
      vv.dispatchEvent(new Event("resize"));
    });

    expect(screen.getByTestId("thread")).toHaveTextContent("open");
    expect(varOf("--kb-inset")).toBe("336px");
    input.remove();
  });

  it("reports closed when there is no visualViewport", () => {
    Object.defineProperty(window, "visualViewport", { value: undefined, configurable: true });
    __resetViewportStore();
    render(<Surface id="solo" />);
    expect(screen.getByTestId("solo")).toHaveTextContent("closed");
  });
});
