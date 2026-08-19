import { Providers } from "@app/providers";
import { AppRouter } from "@app/router";
import { UpdateGate } from "@core/version/update-gate";

export function App() {
  return (
    <UpdateGate>
      <Providers>
        <AppRouter />
      </Providers>
    </UpdateGate>
  );
}
