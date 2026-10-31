import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Charge .env.local puis .env (sans écraser les variables déjà définies).
 * Évite une dépendance à dotenv pour les scripts locaux.
 */
export function loadEnv(cwd = process.cwd()) {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(cwd, file);
    if (!existsSync(path)) continue;
    for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

export function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`✖ Variable manquante : ${name} (renseigne-la dans .env.local, voir README).`);
    process.exit(1);
  }
  return value;
}
