import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProposalEvidenceQuote } from "./proposal-evidence";

describe("ProposalEvidenceQuote", () => {
  it("quotes what the client said and names the channel in Spanish", () => {
    const { container } = render(
      <ProposalEvidenceQuote
        evidence={{ quote: "Confirmo la visita para el jueves.", source: "whatsapp" }}
      />,
    );
    expect(screen.getByText(/Confirmo la visita para el jueves\./)).toBeInTheDocument();
    expect(container.textContent).toContain("WhatsApp");
  });

  it("translates every source it can be handed", () => {
    for (const [source, expected] of [
      ["email", "Correo"],
      ["voice", "Nota de voz"],
      ["chat", "Chat"],
    ] as const) {
      const { container, unmount } = render(
        <ProposalEvidenceQuote evidence={{ quote: "algo", source }} />,
      );
      expect(container.textContent).toContain(expected);
      unmount();
    }
  });

  // Every proposal created before the agent started recording evidence has
  // none. An empty bordered block would read as "the client said nothing".
  it("renders nothing when there is no evidence", () => {
    const { container } = render(<ProposalEvidenceQuote evidence={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the quote is blank", () => {
    const { container } = render(
      <ProposalEvidenceQuote evidence={{ quote: "   ", source: "whatsapp" }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("omits the attribution when the source is unknown", () => {
    const { container } = render(<ProposalEvidenceQuote evidence={{ quote: "algo" }} />);
    expect(container.querySelector("figcaption")).toBeNull();
  });
});
