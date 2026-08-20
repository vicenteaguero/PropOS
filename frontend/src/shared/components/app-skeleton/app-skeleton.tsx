import { Skeleton } from "@/components/ui/skeleton";

/**
 * Full-page loading skeleton shown while auth/session bootstraps (e.g. right
 * after login). Mirrors the app shell + home layout so the transition feels
 * intentional instead of a frozen spinner.
 */
export function AppSkeleton() {
  return (
    <div className="min-h-dvh bg-background">
      {/* top bar */}
      <div className="flex h-[var(--app-header-h,3.5rem)] items-center justify-between border-b border-border px-4 lg:px-8">
        <Skeleton className="h-8 w-40 rounded-full" />
        <div className="flex items-center gap-2">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="size-9 rounded-full" />
        </div>
      </div>

      {/* content */}
      <div className="mx-auto w-full max-w-7xl px-5 py-7 lg:px-8">
        <Skeleton className="h-9 w-56 lg:w-72" />
        <Skeleton className="mt-5 h-14 w-full max-w-2xl rounded-xl" />

        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] rounded-xl" />
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
