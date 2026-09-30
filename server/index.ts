import { createServer } from "./app.ts";

const app = createServer();
let closing = false;

async function shutdown() {
  if (closing) return;
  closing = true;

  try {
    await app.close();
  } catch (error) {
    console.error("Failed to close the bootstrap server:", error);
    process.exitCode = 1;
  }
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

try {
  const address = await app.listen({ host: "127.0.0.1", port: 4310 });
  console.log(`Bootstrap server listening at ${address}; runtime NOT_CONFIGURED.`);
} catch (error) {
  console.error("Failed to start the bootstrap server:", error);
  process.exitCode = 1;
  await shutdown();
}
