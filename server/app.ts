import Fastify from "fastify";
import type { BootstrapHealth } from "../shared/health.ts";

export function createServer() {
  const app = Fastify();

  app.get<{ Reply: BootstrapHealth }>("/health", async () => ({
    ok: true,
    phase: "bootstrap",
    runtime: "NOT_CONFIGURED",
  }));

  return app;
}
