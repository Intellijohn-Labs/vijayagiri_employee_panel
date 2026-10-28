import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, readToken } from "@/lib/session-token";

/** First gate for root-only pages: a valid signed session that belongs to the root admin. The pages' server actions check again against the database. */
export function proxy(request: NextRequest) {
  const session = readToken(request.cookies.get(COOKIE)?.value);
  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  if (!session.root) return NextResponse.redirect(new URL("/claims", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
