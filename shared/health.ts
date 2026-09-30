/** The bootstrap service's health response; this is not an execution protocol. */
export interface BootstrapHealth {
  ok: true;
  phase: "bootstrap";
  runtime: "NOT_CONFIGURED";
}
