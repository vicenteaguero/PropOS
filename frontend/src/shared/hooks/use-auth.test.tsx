import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Supabase reports the same session twice on every load: `getSession()` resolves
 * with it, and `onAuthStateChange` fires `INITIAL_SESSION` with it. This stub
 * reproduces exactly that, because it is the condition the guard exists for.
 */
const SESSION = { user: { id: "u-1" } };
let authCallback: ((event: string, session: unknown) => void) | null = null;

vi.mock("@core/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: "u-1",
              full_name: "Vicente",
              role: "ADMIN",
              tenant_id: "t-1",
              is_active: true,
              avatar_url: null,
              admin_scope: [],
            },
            error: null,
          }),
        }),
      }),
    }),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: SESSION } })),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        authCallback = cb;
        // Supabase emits this synchronously on subscribe.
        cb("INITIAL_SESSION", SESSION);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      signOut: vi.fn(),
    },
  },
}));

const requests: string[] = [];
vi.mock("@shared/api/http", () => ({
  apiRequest: vi.fn(async (path: string) => {
    requests.push(path);
    if (path === "/v1/memberships/me") {
      return [
        {
          user_id: "u-1",
          tenant_id: "t-1",
          tenant_name: "Demo",
          tenant_slug: "demo",
          role: "ADMIN",
          admin_scope: [],
          is_dev_admin: false,
          view: "admin",
          is_active: true,
        },
      ];
    }
    if (path === "/v1/grants/me") return [];
    return {};
  }),
  getActiveTenantId: () => null,
  setActiveTenantId: vi.fn(),
}));

vi.mock("@core/query/persister", () => ({ clearPersistedQueries: vi.fn() }));

const { useAuthProvider } = await import("./use-auth");

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe("useAuthProvider", () => {
  beforeEach(() => {
    requests.length = 0;
    authCallback = null;
  });

  it("boots the identity handshake once for a session reported twice", async () => {
    // The bug this guards: four `/memberships/me`, four `/grants/me` and four
    // `POST /memberships/activate` — a WRITE — per page load, because the same
    // session arrived from two Supabase channels and StrictMode ran the effect
    // twice on top of that.
    renderHook(() => useAuthProvider(), { wrapper });

    await waitFor(() => expect(requests).toContain("/v1/grants/me"));

    const activations = requests.filter((p) => p === "/v1/memberships/activate");
    expect(activations).toHaveLength(1);
    expect(requests.filter((p) => p === "/v1/memberships/me")).toHaveLength(1);
  });

  it("does not re-run the handshake when the token refreshes", async () => {
    renderHook(() => useAuthProvider(), { wrapper });
    await waitFor(() => expect(requests).toContain("/v1/grants/me"));
    requests.length = 0;

    // Same person, new token — an hourly event in every open tab.
    authCallback?.("TOKEN_REFRESHED", { ...SESSION });

    await new Promise((r) => setTimeout(r, 20));
    expect(requests).toEqual([]);
  });
});
