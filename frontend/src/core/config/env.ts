interface AppEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  API_URL: string;
}

export const ENV: AppEnv = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL as string,
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  API_URL: import.meta.env.VITE_API_URL as string,
};
