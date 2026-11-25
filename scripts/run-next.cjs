// Runs the Next.js CLI with scripts/fs-compat.cjs preloaded in every Node process it spawns.
// Usage: node scripts/run-next.cjs <dev|build|start> [...args]
const { spawn } = require("child_process");
const path = require("path");

// forward slashes: NODE_OPTIONS treats backslashes as escapes
const shim = path.join(__dirname, "fs-compat.cjs").split(path.sep).join("/");
const env = { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --require "${shim}"`.trim() };
const bin = require.resolve("next/dist/bin/next");

const child = spawn(process.execPath, [bin, ...process.argv.slice(2)], { stdio: "inherit", env });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
