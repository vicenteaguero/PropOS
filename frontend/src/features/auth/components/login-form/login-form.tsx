import { useState, type FormEvent } from "react";
import { useLogin } from "@features/auth/hooks/use-login";
import { LoadingSpinner } from "@shared/components/loading-spinner/loading-spinner";

const EMAIL_LABEL = "Correo electr\u00F3nico";
const PASSWORD_LABEL = "Contrase\u00F1a";
const SUBMIT_LABEL = "Iniciar Sesi\u00F3n";
const ERROR_PREFIX = "Error:";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading, error } = useLogin();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await login({ email, password });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4 px-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="login-email" className="text-sm font-medium text-gris-acero">
          {EMAIL_LABEL}
        </label>
        <input
          id="login-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 rounded-md border border-gris-acero/30 bg-negro-carbon px-3 py-2 text-blanco-nieve placeholder:text-gris-acero/50 focus:border-rosa-antiguo focus:outline-none focus:ring-1 focus:ring-rosa-antiguo"
          disabled={isLoading}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="login-password" className="text-sm font-medium text-gris-acero">
          {PASSWORD_LABEL}
        </label>
        <input
          id="login-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-11 rounded-md border border-gris-acero/30 bg-negro-carbon px-3 py-2 text-blanco-nieve placeholder:text-gris-acero/50 focus:border-rosa-antiguo focus:outline-none focus:ring-1 focus:ring-rosa-antiguo"
          disabled={isLoading}
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-900/20 px-3 py-2 text-sm text-red-400" role="alert">
          {ERROR_PREFIX} {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="flex min-h-11 items-center justify-center rounded-md bg-rosa-antiguo px-4 py-3 text-sm font-semibold text-negro-carbon transition-colors duration-150 hover:bg-rosa-suave disabled:opacity-50"
      >
        {isLoading ? <LoadingSpinner size="sm" /> : SUBMIT_LABEL}
      </button>
    </form>
  );
}
