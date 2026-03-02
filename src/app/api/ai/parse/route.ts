// API Route: POST /api/ai/parse — server-only text parse endpoint
import { NextRequest, NextResponse } from "next/server";
import { parseWithAI } from "@/application/services/finance-parser";

export const runtime = "nodejs";

async function isAuthenticated(req: NextRequest): Promise<boolean> {
    return !!req.cookies.get("coki_session")?.value;
}

export async function POST(req: NextRequest) {
    if (!(await isAuthenticated(req))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null) as { text?: string } | null;
    if (!body?.text || typeof body.text !== "string") {
        return NextResponse.json({ error: "text es requerido" }, { status: 400 });
    }

    const result = await parseWithAI(body.text.trim());
    return NextResponse.json(result);
}
