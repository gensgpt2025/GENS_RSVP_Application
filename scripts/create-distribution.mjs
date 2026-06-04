import { copyFile, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = process.cwd();
const appName = "gens-schedule";
const releaseDir = join(root, "dist", appName);

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(from, to) {
  if (!(await exists(from))) return;

  await mkdir(to, { recursive: true });
  const entries = await import("node:fs/promises").then(({ readdir }) => readdir(from, { withFileTypes: true }));

  for (const entry of entries) {
    const source = join(from, entry.name);
    const target = join(to, entry.name);

    if (entry.isDirectory()) {
      await copyDir(source, target);
    } else if (entry.isFile()) {
      await mkdir(dirname(target), { recursive: true });
      await copyFile(source, target);
    }
  }
}

await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });

await copyDir(join(root, ".next", "standalone"), releaseDir);
await copyDir(join(root, ".next", "static"), join(releaseDir, ".next", "static"));
await copyDir(join(root, "public"), join(releaseDir, "public"));
await copyFile(join(root, ".env.example"), join(releaseDir, ".env.example"));

await writeFile(
  join(releaseDir, "README.txt"),
  [
    "GENS Schedule distribution",
    "",
    "1. Copy .env.example to .env and set the real values.",
    "2. Start the app with: node server.js",
    "3. Open: http://localhost:3000",
    "",
    "Optional:",
    "- Set PORT=8080 to run on another port.",
    "- Set HOSTNAME=0.0.0.0 to allow access from another device on the same network.",
    "",
  ].join("\n"),
);

console.log(`Distribution created at ${releaseDir}`);
