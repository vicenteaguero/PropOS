interface AuthErrorProps {
  message: string;
}

/** Soft inline error banner for auth forms. */
export function AuthError({ message }: AuthErrorProps) {
  return (
    <div
      className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
      role="alert"
    >
      {message}
    </div>
  );
}
