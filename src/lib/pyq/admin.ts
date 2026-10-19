import { env } from "@/lib/env.server";
import { getSessionUser } from "@/lib/auth/verify.server";
import { UnauthorizedError } from "@/lib/auth/verify.server";

/** Comma-separated admin emails from ADMIN_EMAILS env (server only). */
export function adminEmails(): string[] {
  const raw = env("ADMIN_EMAILS") ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = adminEmails();
  if (list.length === 0) return false;
  return list.includes(email.trim().toLowerCase());
}

/**
 * Require signed-in admin. Uses session email — never trust client-sent email.
 * Throws UnauthorizedError or a plain Error with a safe message.
 */
export async function requireAdmin(bearerToken?: string): Promise<{
  userId: string;
  email: string;
}> {
  const user = await getSessionUser(bearerToken);
  if (!user) throw new UnauthorizedError();
  if (!isAdminEmail(user.email)) {
    throw new Error("Admin access required.");
  }
  return { userId: user.id, email: user.email! };
}
