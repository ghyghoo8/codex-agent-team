import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../server/app.ts";

test("health reports the bootstrap service and unconfigured runtime", async (t) => {
  const app = createServer();
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/health" });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
    phase: "bootstrap",
    runtime: "NOT_CONFIGURED",
  });
});

test("bootstrap does not expose business write routes", async (t) => {
  const app = createServer();
  t.after(() => app.close());

  for (const url of ["/commands", "/runs"]) {
    const response = await app.inject({ method: "POST", url, payload: {} });
    assert.equal(response.statusCode, 404, `${url} must not accept business writes`);
  }
});
