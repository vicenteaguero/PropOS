import { useState, useCallback } from "react";
import { supabase } from "@core/supabase/client";
import { createLogger } from "@core/logging/logger";
import type { LoginCredentials } from "@features/auth/types";

const logger = createLogger("Login");

interface UseLoginReturn {
  login: (credentials: LoginCredentials) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

export function useLogin(): UseLoginReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (credentials: LoginCredentials): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    logger.info("auth", "Login attempt", { email: credentials.email });

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (authError) {
      logger.error("error", "Login failed", { message: authError.message });
      setError(authError.message);
      setIsLoading(false);
      return false;
    }

    logger.info("success", "Login successful");
    setIsLoading(false);
    return true;
  }, []);

  return { login, isLoading, error };
}
