#!/usr/bin/env node
/**
 * Crée (ou promeut) un compte administrateur du chat.
 *
 *   npm run create-admin -- toi@scutify.fr 'MotDePasseSolide' 'Équipe Scutify'
 *
 * Nécessite NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans
 * .env.local. La service key contourne RLS : à garder en local, jamais sur
 * Vercel, jamais dans une variable NEXT_PUBLIC_.
 */
import { createClient } from "@supabase/supabase-js";

import { loadEnv, requireEnv } from "./lib/env.mjs";

loadEnv();

const [emailArg, password, pseudoArg = "Équipe Scutify"] = process.argv.slice(2);
const email = emailArg?.trim().toLowerCase();
const pseudo = pseudoArg.trim();

if (!email || !password) {
  console.error("Usage : npm run create-admin -- <email> <mot-de-passe> [pseudo]");
  process.exit(1);
}
if (password.length < 10) {
  console.error("✖ Choisis un mot de passe d'au moins 10 caractères.");
  process.exit(1);
}
if (pseudo.length < 2 || pseudo.length > 20) {
  console.error("✖ Le pseudo doit contenir entre 2 et 20 caractères.");
  process.exit(1);
}

const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserIdByEmail(target) {
  for (let page = 1; page < 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === target);
    if (user) return user.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

let userId;
const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
if (created.error) {
  const alreadyExists = created.error.code === "email_exists" || /already/i.test(created.error.message);
  if (!alreadyExists) {
    console.error("✖ Création du compte impossible :", created.error.message);
    process.exit(1);
  }
  userId = await findUserIdByEmail(email);
  if (!userId) {
    console.error("✖ Le compte existe mais est introuvable.");
    process.exit(1);
  }
  const updated = await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true });
  if (updated.error) {
    console.error("✖ Mise à jour du mot de passe impossible :", updated.error.message);
    process.exit(1);
  }
  console.log("ℹ Compte existant : mot de passe mis à jour.");
} else {
  userId = created.data.user.id;
}

const { error: profileError } = await supabase
  .from("profiles")
  .upsert({ id: userId, pseudo, email, role: "admin" }, { onConflict: "id" });

if (profileError) {
  console.error("✖ Création du profil admin impossible :", profileError.message);
  console.error("  La migration supabase/migrations/*_live_chat.sql a-t-elle été exécutée ?");
  process.exit(1);
}

console.log(`✔ ${email} est administrateur (pseudo « ${pseudo} »). Connexion : /admin`);
