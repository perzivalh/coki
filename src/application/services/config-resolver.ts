// Application Service: ConfigResolver
// Resolves configuration values from the DB settings table.
// All operational config must come from DB — no hardcoding.
import type { Config } from "@/domain/entities";

export interface IConfigRepository {
    getAll(): Promise<Config[]>;
    get(key: string): Promise<Config | null>;
    set(key: string, value: string, description?: string): Promise<Config>;
}

export class ConfigResolver {
    private cache: Map<string, string> = new Map();

    constructor(private readonly repo: IConfigRepository) { }

    async get(key: string, defaultValue?: string): Promise<string | undefined> {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        const config = await this.repo.get(key);
        if (config) {
            this.cache.set(key, config.value);
            return config.value;
        }
        return defaultValue;
    }

    async getAll(): Promise<Record<string, string>> {
        const configs = await this.repo.getAll();
        const result: Record<string, string> = {};
        for (const c of configs) {
            result[c.key] = c.value;
            this.cache.set(c.key, c.value);
        }
        return result;
    }

    invalidate(): void {
        this.cache.clear();
    }
}
