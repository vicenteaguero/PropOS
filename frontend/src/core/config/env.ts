interface AppEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  API_URL: string;
  VAPID_PUBLIC_KEY: string;
}

export const ENV: AppEnv = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL as string,
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  API_URL: import.meta.env.VITE_API_URL as string,
  VAPID_PUBLIC_KEY: (import.meta.env.VITE_VAPID_PUBLIC_KEY as string) ?? "",
};
