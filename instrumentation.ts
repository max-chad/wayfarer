// Server bootstrap: background sweeps that must not run inside user requests.
// The NEXT_RUNTIME comparison must stay a plain literal check: webpack folds it to dead code in
// edge compiles, so the node-only better-sqlite3 module graph is never pulled in there.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { sweepPriceAlerts } = await import("./lib/data/commerce");
    setInterval(sweepPriceAlerts, 15 * 60_000).unref(); // alert checks are themselves rate-limited to 1/h per alert
  }
}
