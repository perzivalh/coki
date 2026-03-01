// API Route: GET /api/openapi — serves OpenAPI JSON spec
import { NextResponse } from "next/server";
import { openapiSpec } from "@/infrastructure/openapi/spec";

export const runtime = "nodejs";

export async function GET() {
    return NextResponse.json(openapiSpec, {
        headers: { "Access-Control-Allow-Origin": "*" },
    });
}
