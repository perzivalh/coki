// scripts/migrate.mjs — Supabase migrations via direct PostgreSQL (Supavisor pooler)
import { readFileSync, readdirSync } from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnv() {
    const lines = readFileSync(join(ROOT, ".env"), "utf-8").split("\n");
    const env = {};
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    return env;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const DB_PASSWORD = env.DB_PASSWORD;
const projectRef = new URL(SUPABASE_URL).hostname.split(".")[0];

if (!DB_PASSWORD) {
    console.error("❌ Falta DB_PASSWORD en .env");
    process.exit(1);
}

// Supavisor pooler hosts to try (Supabase auto-routes, just try all regions)
const HOSTS = [
    // Transaction mode (port 6543) — Supavisor
    `postgresql://postgres.${projectRef}:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${projectRef}:${DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${projectRef}:${DB_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${projectRef}:${DB_PASSWORD}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`,
    // Session mode (port 5432) — direct
    `postgresql://postgres.${projectRef}:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
];

let client = null;
for (const connStr of HOSTS) {
    const host = new URL(connStr.replace("postgresql://", "https://")).hostname;
    process.stdout.write(`   Intentando ${host}... `);
    const c = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
    try {
        await c.connect();
        console.log("✅");
        client = c;
        break;
    } catch (e) {
        console.log(`❌ (${e.message.slice(0, 60)})`);
        await c.end().catch(() => { });
    }
}

if (!client) {
    console.error("\n❌ No se pudo conectar a Supabase por ningún endpoint.");
    console.error("   Verifica tu DB_PASSWORD en .env (Settings > Database > Database password)");
    console.error("   O ve al SQL Editor de Supabase y pega el contenido de supabase/migrations/*.sql manualmente.");
    process.exit(1);
}

console.log(`\n🚀 Conectado al proyecto: ${projectRef}\n`);

// Run migrations
const migrationsDir = join(ROOT, "supabase", "migrations");
const files = readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();

for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    console.log(`📄 Migrando: ${file}`);
    try {
        await client.query(sql);
        console.log(`   ✅ OK\n`);
    } catch (e) {
        if (e.message.includes("already exists") || e.message.includes("duplicate")) {
            console.log(`   ⚠️  Saltado (ya existe)\n`);
        } else {
            console.error(`   ❌ Error: ${e.message}\n`);
            await client.end();
            process.exit(1);
        }
    }
}

// Run seed
console.log("📦 Ejecutando seed.sql...");
try {
    await client.query(readFileSync(join(ROOT, "supabase", "seed.sql"), "utf-8"));
    console.log("   ✅ Seed OK\n");
} catch (e) {
    console.log(`   ⚠️  Seed (ya existen datos — OK): ${e.message.slice(0, 80)}\n`);
}

await client.end();
console.log("✅ Migraciones completadas.\n");
