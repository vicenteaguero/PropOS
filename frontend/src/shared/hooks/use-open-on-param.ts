import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Opens a create flow when the URL asks for it, then clears the flag.
 *
 * Home's quick actions link to `…?nuevo=1` rather than calling a handler, so
 * the action survives a reload, can be bookmarked, and works from anywhere
 * without the caller holding a reference to the target page's state. The param
 * is consumed on arrival — leaving it in the URL would reopen the sheet on
 * every Back.
 */
export function useOpenOnParam(param: string, open: () => void): void {
  const [params, setParams] = useSearchParams();
  const flag = params.get(param);

  useEffect(() => {
    if (flag !== "1") return;
    const next = new URLSearchParams(params);
    next.delete(param);
    setParams(next, { replace: true });
    open();
    // `open` is a fresh closure on every render; re-running on it would fire
    // the sheet repeatedly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flag, param]);
}
