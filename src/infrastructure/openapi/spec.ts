// Infrastructure: OpenAPI definition
// Serves the openapi.json spec for all Coki API endpoints.

export const openapiSpec = {
    openapi: "3.0.3",
    info: {
        title: "Coki API",
        version: "0.1.0",
        description: "Coki personal assistant — REST API stubs (Sprint 0)",
    },
    servers: [{ url: "/api", description: "Local / Cloudflare Pages" }],
    paths: {
        "/hello": {
            get: {
                summary: "Health check",
                operationId: "getHello",
                responses: {
                    "200": {
                        description: "OK",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        ok: { type: "boolean" },
                                        version: { type: "string" },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        "/auth/login": {
            post: {
                summary: "Login with PIN",
                operationId: "postAuthLogin",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["pin"],
                                properties: { pin: { type: "string", minLength: 4 } },
                            },
                        },
                    },
                },
                responses: {
                    "200": { description: "Login successful; token returned" },
                    "401": { description: "Invalid PIN" },
                },
            },
        },
        "/auth/logout": {
            post: {
                summary: "Logout",
                operationId: "postAuthLogout",
                responses: {
                    "200": { description: "Logged out" },
                },
            },
        },
        "/whatsapp/webhook": {
            get: {
                summary: "WhatsApp webhook verification",
                operationId: "getWhatsappWebhook",
                parameters: [
                    { name: "hub.mode", in: "query", schema: { type: "string" } },
                    { name: "hub.verify_token", in: "query", schema: { type: "string" } },
                    { name: "hub.challenge", in: "query", schema: { type: "string" } },
                ],
                responses: {
                    "200": { description: "Challenge echoed back" },
                    "403": { description: "Invalid verify token" },
                },
            },
            post: {
                summary: "WhatsApp incoming message webhook",
                operationId: "postWhatsappWebhook",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { type: "object" } } },
                },
                responses: {
                    "200": { description: "Message received and logged" },
                },
            },
        },
        "/settings": {
            get: {
                summary: "Get all settings",
                operationId: "getSettings",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": { description: "All config settings" },
                    "401": { description: "Unauthorized" },
                },
            },
        },
    },
    components: {
        securitySchemes: {
            bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
    },
};
