import { z } from "zod";

/**
 * Runtime-validated environment variables.
 *
 * During `next build` there is no real database yet — Next still imports
 * server modules to collect page data. We accept build-time placeholders and
 * enforce the full production contract only when the server actually starts.
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
});

type ServerEnv = z.infer<typeof serverEnvSchema>;

function isNextBuildPhase(): boolean {
  return (
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.NEXT_PHASE === "phase-export"
  );
}

function buildStubEnv(): ServerEnv {
  return serverEnvSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL ?? "file:/tmp/next-build.db",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ??
      "pk_test_YnVpbGQtcGxhY2Vob2xkZXIuY2xlcmsuYWNjb3VudHMuZGV2JA",
    CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ?? "sk_test_build_placeholder",
    NODE_ENV: process.env.NODE_ENV ?? "production",
    LOG_LEVEL: process.env.LOG_LEVEL,
  });
}

function loadEnv(): ServerEnv {
  if (isNextBuildPhase()) {
    return buildStubEnv();
  }

  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  if (parsed.data.NODE_ENV === "production") {
    if (!parsed.data.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
      throw new Error("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required in production");
    }
    if (!parsed.data.CLERK_SECRET_KEY) {
      throw new Error("CLERK_SECRET_KEY is required in production");
    }
  }

  return parsed.data;
}

export const env = loadEnv();
