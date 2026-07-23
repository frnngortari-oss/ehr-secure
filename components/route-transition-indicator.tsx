"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function isPlainLeftClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export default function RouteTransitionIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const stop = () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      document.documentElement.classList.remove("is-route-pending");
    };

    const start = () => {
      document.documentElement.classList.add("is-route-pending");
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(stop, 8000);
    };

    const onClick = (event: MouseEvent) => {
      if (!isPlainLeftClick(event) || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      const link = target?.closest("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;

      const nextUrl = new URL(link.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      if (nextUrl.origin !== currentUrl.origin) return;
      if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search) return;

      start();
    };

    const onSubmit = (event: SubmitEvent) => {
      if (event.defaultPrevented) return;
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.method.toLowerCase() === "dialog") return;
      start();
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("pageshow", stop);

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("pageshow", stop);
      stop();
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove("is-route-pending");
  }, [pathname, searchParams]);

  return <div className="route-progress" aria-hidden="true" />;
}
