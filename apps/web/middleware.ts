import { NextRequest, NextResponse } from "next/server";

const AVAILABLE_UNITS_HOSTS = new Set(["properties.colonus.lat", "propiedades.colonus.lat"]);

const getHost = (request: NextRequest): string =>
  (request.headers.get("host") ?? "").toLowerCase().split(":")[0] ?? "";

export function middleware(request: NextRequest) {
  const host = getHost(request);
  if (!AVAILABLE_UNITS_HOSTS.has(host)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  if (pathname === "/") {
    url.pathname = "/available-units";
    return NextResponse.rewrite(url);
  }

  if (!pathname.startsWith("/available-units")) {
    url.pathname = `/available-units${pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"]
};
