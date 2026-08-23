import RLSkeleton from "react-loading-skeleton";
import { cn } from "@/lib/utils";

/**
 * The app's loading placeholder.
 *
 * Backed by `react-loading-skeleton` rather than a `bg-muted` pulse: a block
 * that fades in and out reads as "this is broken and blinking", while a sweep
 * across the block reads as "this is arriving". Its colours come from
 * `--base-color` / `--highlight-color`, which `index.css` binds to our tokens
 * in both themes, so there is no `<SkeletonTheme>` provider to forget.
 *
 * The API is unchanged from the shadcn primitive it replaced — sizing still
 * arrives as `className` — because ~30 call sites size these by hand. The
 * classes land on the wrapper and the shimmer fills it.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <RLSkeleton
      containerClassName={cn("block leading-none", className)}
      className="!block !h-full !w-full"
      {...(props as { style?: React.CSSProperties })}
    />
  );
}

export { Skeleton };
