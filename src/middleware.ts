// Edge Middleware — auth guard for /dashboard routes
// Must use "export default function middleware" format for Edge runtime
// (required for Cloudflare Pages via @opennextjs/cloudflare)
import { NextRequest, NextResponse } from "next/server";

export default function middleware(req: NextRequest) {
    const token = req.cookies.get("coki_session")?.value;
    if (!token) {
        const loginUrl = req.nextUrl.clone();
        loginUrl.pathname = "/login";
        loginUrl.searchParams.set("redirect", req.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard/:path*"],
};
