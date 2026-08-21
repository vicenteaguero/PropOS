import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorState } from "./error-state";
import { ApiError } from "@shared/api/api-error";

describe("ErrorState", () => {
  it("shows the server's sentence rather than a generic one", () => {
    render(<ErrorState error={new ApiError(409, "Falta al menos una foto.")} />);
    expect(screen.getByText("Falta al menos una foto.")).toBeInTheDocument();
  });

  it("offers Reintentar for a failure that might pass next time", () => {
    render(<ErrorState error={new ApiError(500, "Se cayó")} onRetry={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("does not offer Reintentar for a permission error", () => {
    // Clicking it would never work; the answer is "ask an admin", not "again".
    render(<ErrorState error={new ApiError(403, "No tienes permiso")} onRetry={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });

  it("does not offer Reintentar for a record that is gone", () => {
    render(<ErrorState error={new ApiError(404, "No existe")} onRetry={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });

  it("still offers Reintentar for a plain Error, which carries no status", () => {
    render(<ErrorState error={new Error("Network down")} onRetry={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
