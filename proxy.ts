import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

// Production CSP with a per-request nonce (Next reads the CSP header from the request, extracts
// the nonce, and attaches it to its own scripts; layout.tsx passes x-nonce to the theme script).
// next.config.ts no longer emits a CSP header — this is the only source, so script-src needs no
// 'unsafe-inline'.
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") return NextResponse.next(); // dev: same as before this change, no CSP (React needs 'unsafe-eval' there)
  const nonce = Buffer.from(crypto.randomBytes(16)).toString("base64");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://upload.wikimedia.org https://thumb.wikimedia.org https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: "/((?!api|_next/static|_next/image|favicon.ico).*)",
};
