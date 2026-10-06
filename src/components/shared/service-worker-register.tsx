"use client";

import { useEffect } from "react";

/**
 * Registers the service worker that makes CafeFlow installable as a PWA.
 * The worker itself only caches immutable static assets — dashboards and
 * API responses always come fresh from the network.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((error) => console.warn("[pwa] service worker registration skipped:", error));
    };
    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
