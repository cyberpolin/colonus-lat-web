import { NextRequest, NextResponse } from "next/server";

const AVAILABLE_UNITS_HOSTS = new Set(["properties.colonus.lat", "propiedades.colonus.lat"]);
const WEBSITE_HOSTS = new Set(["www.colonus.lat", "colonus.lat"]);
const APP_HOSTS = new Set(["app.colonus.lat"]);

const getHost = (request: NextRequest): string =>
  (request.headers.get("host") ?? "").toLowerCase().split(":")[0] ?? "";

export function middleware(request: NextRequest) {
  const host = getHost(request);
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

  if (AVAILABLE_UNITS_HOSTS.has(host)) {
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

  if (WEBSITE_HOSTS.has(host)) {
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/website";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  if (APP_HOSTS.has(host)) {
    if (!pathname.startsWith("/app")) {
      const url = request.nextUrl.clone();
      url.pathname = pathname === "/" ? "/app" : `/app${pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"]
};
