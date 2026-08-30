// Security middleware — extracted from server.ts (Phase 3 decomposition)
import express from "express";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

// ─── Structured logging (Feature 6) ─────────────────────────────────────────
export const requestContext = new AsyncLocalStorage<{ requestId: string }>();

export function logWithId(...args: unknown[]) {
  const store = requestContext.getStore();
  if (store) {
    console.log(`[req:${store.requestId.slice(0, 8)}]`, ...args);
  } else {
    console.log(...args);
  }
}

export function isOriginAllowed(origin: string, port?: number): boolean {
  if (!origin) return false;
  try {
    const normalizedOrigin = origin.trim().replace(/\/$/, "");
    const url = new URL(normalizedOrigin);
    const originHost = url.hostname;

    const envOrigins = (process.env.CORS_ORIGINS || "")
      .split(",")
      .map((o) => o.trim().replace(/\/$/, ""))
      .filter(Boolean);

    const configuredOrigins = new Set([
      process.env.APP_URL,
      "https://findmydonor.online",
      "https://www.findmydonor.online",
      "http://findmydonor.online",
      "http://www.findmydonor.online",
      "https://admin.findmydonor.online",
      "http://admin.findmydonor.online",
      "http://localhost:5173",
      "http://localhost:5001",
      "http://localhost:6001",
      "http://localhost:7000",
      "http://localhost:3000",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:5001",
      "http://127.0.0.1:6001",
      "http://127.0.0.1:7000",
      "http://127.0.0.1:3000",
      ...(port ? [`http://145.241.154.187:${port}`, `http://localhost:${port}`, `http://127.0.0.1:${port}`] : []),
      ...envOrigins,
    ].map((o) => o?.trim().replace(/\/$/, "")).filter((o): o is string => Boolean(o)));

    if (configuredOrigins.has(normalizedOrigin)) {
      return true;
    }

    return (
      originHost === "localhost" ||
      originHost === "127.0.0.1" ||
      originHost === "findmydonor.online" ||
      originHost === "www.findmydonor.online" ||
      originHost === "admin.findmydonor.online" ||
      originHost === "145.241.154.187"
    );
  } catch {
    return false;
  }
}

export function applySecurityMiddleware(app: express.Express, port: number) {
  // Feature 6: x-request-id middleware — wraps every handler in AsyncLocalStorage context
  app.use((req, _res, next) => {
    const rid = (req.headers["x-request-id"] as string) || randomUUID();
    req.headers["x-request-id"] = rid;
    requestContext.run({ requestId: rid }, () => next());
  });

  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
    // COOP: API responses keep the strong same-origin isolation. The HTML
    // document (the Firebase signInWithPopup opener) must use unsafe-none so
    // the cross-origin popup (findmydonor-0.firebaseapp.com) can post the auth
    // result back to the opener — same-origin severs that channel and blocks
    // Google popup login in production. Localhost works because the Vite dev
    // server sends no COOP header.
    res.setHeader(
      "Cross-Origin-Opener-Policy",
      req.path.startsWith("/api") ? "same-origin" : "unsafe-none"
    );

    const isProd = process.env.NODE_ENV === "production";
    if (isProd) {
      // Production CSP: Google Sign-In/Firebase require 'unsafe-inline' for the
      // auth continuation scripts; the per-request nonce proved incompatible
      // with the Firebase/Google auth flow in production. 'unsafe-eval' is NOT
      // included — all other directives remain unchanged.
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; connect-src 'self' https: wss: http:; img-src 'self' data: https: blob:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' https:; font-src 'self' data: https://fonts.gstatic.com; frame-src 'self' https://apis.google.com https://*.firebaseapp.com https://accounts.google.com; base-uri 'self'; frame-ancestors 'none'; object-src 'none'"
      );
    } else {
      // Dev: keep unsafe-inline/unsafe-eval for Vite HMR + dev tooling.
      // ws: is required because Vite's middleware-mode HMR socket is an
      // insecure websocket on localhost (wss: alone does not cover it).
      // font-src/frame-src: Google Fonts + Firebase signInWithPopup iframe.
      res.setHeader("Content-Security-Policy", "default-src 'self'; connect-src 'self' https: wss: ws: http:; img-src 'self' data: https: blob:; style-src 'self' 'unsafe-inline' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; font-src 'self' data: https://fonts.gstatic.com; frame-src 'self' https://apis.google.com https://*.firebaseapp.com https://accounts.google.com; base-uri 'self'; frame-ancestors 'none'; object-src 'none'");
    }
    if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

    if (!req.path.startsWith("/api")) return next();
    const origin = req.header("origin")?.replace(/\/$/, "");
    if (origin) {
      const reqHost = (req.header("x-forwarded-host") || req.header("host") || "").split(":")[0];
      const originHost = (() => {
        try { return new URL(origin).hostname; } catch { return ""; }
      })();

      const isAllowed = isOriginAllowed(origin, port) || (originHost !== "" && originHost === reqHost);

      if (!isAllowed) {
        return res.status(403).json({ error: "Origin not allowed." });
      }
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type,X-Requested-With,X-Request-ID");
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  // Request logger
  app.use((req, _res, next) => {
    if (req.path.startsWith("/api")) {
      console.log(`[HTTP] ${req.method} ${req.path} - IP: ${req.ip} - Forwarded: ${req.headers["x-forwarded-for"]}`);
    }
    next();
  });
}
