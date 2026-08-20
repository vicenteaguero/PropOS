/**
 * The one backdrop treatment.
 *
 * There used to be four independent overlays with three different looks — Dialog
 * blurred, Sheet and AlertDialog did not, the sidebar rail had its own — so
 * ResponsiveSheet rendered blurred on a laptop and sharp on a phone for the very
 * same component. Import this instead of writing a backdrop by hand.
 */
export const OVERLAY_CLASS =
  "fixed inset-0 z-50 bg-overlay/50 backdrop-blur-md supports-[backdrop-filter]:bg-overlay/35";
