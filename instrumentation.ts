/**
 * Runs once when the server process boots (before handling any request).
 * Importing `lib/env` here forces zod validation of the server environment at
 * startup, so a missing/malformed key fails fast and loudly instead of
 * surfacing later on the first route that happens to need it.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");
  }
}
