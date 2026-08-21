import { describe, expect, it } from "vitest";
import { ApiError } from "./api-error";

/**
 * Every toast in the app prints `error.message`. Before this, a broker who
 * tried to publish a listing with no photo saw
 * `API 409: {"detail":"No se puede publicar. Falta al menos una foto."}` —
 * a status line and a JSON fragment wrapped around a sentence the backend had
 * already written in Spanish for them.
 */
function response(status: number, body: string, ok = false): Response {
  return {
    status,
    ok,
    text: async () => body,
  } as unknown as Response;
}

describe("ApiError.from", () => {
  it("uses the server's own sentence as the message", async () => {
    const err = await ApiError.from(
      response(409, JSON.stringify({ detail: "No se puede publicar. Falta el precio." })),
    );
    expect(err.message).toBe("No se puede publicar. Falta el precio.");
    expect(err.status).toBe(409);
  });

  it("keeps the status so a caller can tell 403 from 500", async () => {
    const forbidden = await ApiError.from(response(403, "{}"));
    const broken = await ApiError.from(response(500, "{}"));
    expect(forbidden.status).toBe(403);
    expect(broken.status).toBe(500);
    expect(forbidden.message).not.toBe(broken.message);
  });

  it("falls back to plain Spanish when the server said nothing useful", async () => {
    const err = await ApiError.from(response(500, ""));
    expect(err.message).toBe("El servidor tuvo un problema. Intenta de nuevo.");
  });

  it("does not print a validation error array at a person", async () => {
    // FastAPI's 422 `detail` is a list of objects meant for developers.
    const err = await ApiError.from(
      response(422, JSON.stringify({ detail: [{ loc: ["body", "x"], msg: "field required" }] })),
    );
    expect(err.message).toBe("No se pudo completar la acción.");
  });

  it("survives a body that is not JSON at all", async () => {
    const err = await ApiError.from(response(502, "<html>Bad Gateway</html>"));
    expect(err.status).toBe(502);
    expect(err.message).toBe("El servidor tuvo un problema. Intenta de nuevo.");
  });

  it("is an Error, so every existing `err instanceof Error` toast keeps working", async () => {
    expect(await ApiError.from(response(400, "{}"))).toBeInstanceOf(Error);
  });
});
