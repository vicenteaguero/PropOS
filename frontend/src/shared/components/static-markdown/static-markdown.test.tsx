import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StaticMarkdown } from "./static-markdown";
import { PRIVACY_POLICY_MD } from "@features/legal/lib/privacy-policy-text";

/**
 * This renderer replaced react-markdown for the privacy policy, which is a
 * compliance document — dropping or garbling a clause would be a real problem,
 * so the last test checks that every source line survives to the DOM rather
 * than just spot-checking constructs.
 */
describe("StaticMarkdown", () => {
  it("renders headings at their source level", () => {
    render(<StaticMarkdown source={"# Título\n\n## Sección"} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Título");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Sección");
  });

  it("joins wrapped paragraph lines into one paragraph", () => {
    const { container } = render(<StaticMarkdown source={"una linea\ny su continuación"} />);
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelector("p")?.textContent).toBe("una linea y su continuación");
  });

  it("renders bullet and numbered lists", () => {
    const { container } = render(<StaticMarkdown source={"- uno\n- dos\n\n1. a\n2. b"} />);
    expect(container.querySelectorAll("ul li")).toHaveLength(2);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
  });

  it("renders a GFM pipe table with scoped header cells", () => {
    const md = "| Dato | Uso |\n| --- | --- |\n| Email | Contacto |\n| RUT | Identidad |";
    render(<StaticMarkdown source={md} />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("Identidad")).toBeTruthy();
  });

  it("renders bold spans as <strong>", () => {
    const { container } = render(<StaticMarkdown source={"texto **fuerte** aquí"} />);
    expect(container.querySelector("strong")?.textContent).toBe("fuerte");
  });

  it("renders blockquotes", () => {
    const { container } = render(<StaticMarkdown source={"> una nota"} />);
    expect(container.querySelector("blockquote")?.textContent).toBe("una nota");
  });

  it("treats HTML in the source as literal text, never as markup", () => {
    const { container } = render(<StaticMarkdown source={"<script>alert(1)</script>"} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("carries every line of the real privacy policy into the output", () => {
    const { container } = render(<StaticMarkdown source={PRIVACY_POLICY_MD} />);
    const rendered = (container.textContent ?? "").replace(/\s+/g, " ");
    const missing = PRIVACY_POLICY_MD.split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !/^[|#>\-*\d.]+$/.test(l))
      // strip the markers the renderer consumes, then require the prose itself
      .map((l) =>
        l
          .replace(/^#{1,4}\s+/, "")
          .replace(/^[-*]\s+/, "")
          .replace(/^\d+\.\s+/, "")
          .replace(/^>\s?/, "")
          .replace(/\*\*/g, "")
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")[0]!
          .trim(),
      )
      .filter((l) => l.length > 3)
      .filter((l) => !rendered.includes(l.replace(/\s+/g, " ")));
    expect(missing).toEqual([]);
  });
});
