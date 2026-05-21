import { z } from "zod";

/**
 * Runtime-validated environment variables.
 *
 * Throws at module load if the process is misconfigured, which surfaces
 * deployment mistakes immediately instead of through obscure downstream
 * failures.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z
    .string()
    .min(16, "NEXTAUTH_SECRET must be at least 16 characters")
    .optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
});

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join(", ");
  throw new Error(`Invalid environment configuration: ${issues}`);
}

if (parsed.data.NODE_ENV === "production") {
  if (!parsed.data.NEXTAUTH_SECRET) {
    throw new Error("NEXTAUTH_SECRET is required in production");
  }
  if (!parsed.data.NEXTAUTH_URL) {
    throw new Error("NEXTAUTH_URL is required in production");
  }
}

export const env = parsed.data;
