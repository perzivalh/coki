// Unit tests: ConfigResolver
import { describe, it, expect, vi } from "vitest";
import { ConfigResolver } from "@/application/services/config-resolver";
import type { IConfigRepository } from "@/application/services/config-resolver";
import type { Config } from "@/domain/entities";

function makeMockRepo(data: Config[]): IConfigRepository {
    return {
        getAll: vi.fn().mockResolvedValue(data),
        get: vi.fn().mockImplementation(async (key: string) => data.find((c) => c.key === key) ?? null),
        set: vi.fn().mockImplementation(async (key: string, value: string) => ({
            key,
            value,
            updated_at: new Date().toISOString(),
        })),
    };
}

describe("ConfigResolver", () => {
    it("returns a known value from the repository", async () => {
        const repo = makeMockRepo([
            { key: "timezone", value: "America/Caracas", updated_at: "" },
        ]);
        const resolver = new ConfigResolver(repo);
        const tz = await resolver.get("timezone");
        expect(tz).toBe("America/Caracas");
    });

    it("returns the default when key not found", async () => {
        const repo = makeMockRepo([]);
        const resolver = new ConfigResolver(repo);
        const val = await resolver.get("missing_key", "default_val");
        expect(val).toBe("default_val");
    });

    it("caches values after first fetch", async () => {
        const repo = makeMockRepo([{ key: "currency", value: "USD", updated_at: "" }]);
        const resolver = new ConfigResolver(repo);
        await resolver.get("currency");
        await resolver.get("currency");
        expect(repo.get).toHaveBeenCalledTimes(1);
    });

    it("clears cache on invalidate()", async () => {
        const repo = makeMockRepo([{ key: "currency", value: "USD", updated_at: "" }]);
        const resolver = new ConfigResolver(repo);
        await resolver.get("currency");
        resolver.invalidate();
        await resolver.get("currency");
        expect(repo.get).toHaveBeenCalledTimes(2);
    });

    it("getAll returns all settings as record", async () => {
        const repo = makeMockRepo([
            { key: "a", value: "1", updated_at: "" },
            { key: "b", value: "2", updated_at: "" },
        ]);
        const resolver = new ConfigResolver(repo);
        const all = await resolver.getAll();
        expect(all).toEqual({ a: "1", b: "2" });
    });
});
