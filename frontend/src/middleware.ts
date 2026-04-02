import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PATHS = [
  "/dashboard",
  "/players",
  "/rooms",
  "/results",
  "/tournaments",
  "/promos",
  "/stats",
  "/settings",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  if (isProtected) {
    const token = request.cookies.get("accessToken")?.value;
    const hasLocalStorageToken =
      request.headers.get("authorization")?.startsWith("Bearer ");

    if (!token && !hasLocalStorageToken) {
      // Client-side auth check will handle the redirect via AuthProvider
      // Middleware only acts as a lightweight guard for SSR
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/players/:path*",
    "/rooms/:path*",
    "/results/:path*",
    "/tournaments/:path*",
    "/promos/:path*",
    "/stats/:path*",
    "/settings/:path*",
  ],
};
