// Edge Middleware — auth guard for /dashboard routes
// Runs in Edge runtime (required for Cloudflare Pages compatibility)
import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
    const session = req.cookies.get("coki_session")?.value;
    if (!session) {
        return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard/:path*"],
};
