// scripts/create-user.mjs — Genera el SQL para crear el usuario con PIN hasheado
// Usage: node scripts/create-user.mjs 1234
import { hash } from "bcryptjs";

const pin = process.argv[2];
if (!pin || pin.length < 4) {
    console.error("Usage: node scripts/create-user.mjs <PIN>");
    console.error("Example: node scripts/create-user.mjs 1234");
    process.exit(1);
}

const pin_hash = await hash(pin, 12);

console.log("\n✅ PIN hasheado. Ejecuta este SQL en Supabase SQL Editor:\n");
console.log("-----------------------------------------------------------");
console.log(`INSERT INTO users (pin_hash) VALUES ('${pin_hash}');`);
console.log("-----------------------------------------------------------\n");
console.log(`PIN configurado: ${pin}`);
console.log("(no guardes el PIN en ningún archivo, solo el hash en la DB)\n");
