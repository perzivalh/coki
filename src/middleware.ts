// Next.js Middleware: protect dashboard routes, redirect unauthenticated users to /login
import { NextRequest, NextResponse } from "next/server";

const PROTECTED_PATHS = ["/dashboard"];

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
    if (!isProtected) return NextResponse.next();

    const token = req.cookies.get("coki_session")?.value;
    if (!token) {
        const loginUrl = req.nextUrl.clone();
        loginUrl.pathname = "/login";
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/dashboard/:path*"],
};
