import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, parse } from "node:path";

const projectRequire = createRequire(import.meta.url);
const nextPackagePath = projectRequire.resolve("next/package.json");
const nextRequire = createRequire(nextPackagePath);

function resolvePackageJson(resolver, name) {
  try {
    return resolver.resolve(`${name}/package.json`);
  } catch (error) {
    if (error.code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error;
  }

  let directory = dirname(resolver.resolve(name));
  const root = parse(directory).root;

  while (directory !== root) {
    const candidate = join(directory, "package.json");
    if (existsSync(candidate)) {
      const packageJson = JSON.parse(readFileSync(candidate, "utf8"));
      if (packageJson.name === name) return candidate;
    }
    directory = dirname(directory);
  }

  throw new Error(`Unable to locate package.json for ${name}`);
}

const requirements = [
  {
    name: "next",
    minimum: "15.5.21",
    packagePath: nextPackagePath,
  },
  {
    name: "postcss",
    minimum: "8.5.23",
    packagePath: resolvePackageJson(nextRequire, "postcss"),
  },
  {
    name: "sharp",
    minimum: "0.35.3",
    packagePath: resolvePackageJson(nextRequire, "sharp"),
  },
];

function parseStableVersion(name, version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`${name} must use a stable x.y.z version; resolved ${version}`);
  }

  return match.slice(1).map(Number);
}

function isAtLeast(actual, minimum) {
  for (let index = 0; index < actual.length; index += 1) {
    if (actual[index] > minimum[index]) return true;
    if (actual[index] < minimum[index]) return false;
  }

  return true;
}

let failed = false;

for (const requirement of requirements) {
  const packageJson = projectRequire(requirement.packagePath);
  const actual = parseStableVersion(requirement.name, packageJson.version);
  const minimum = parseStableVersion(requirement.name, requirement.minimum);
  const valid = isAtLeast(actual, minimum);

  console.log(
    `${valid ? "PASS" : "FAIL"} ${requirement.name}: ${packageJson.version} (minimum ${requirement.minimum})`,
  );

  if (!valid) failed = true;
}

if (failed) {
  console.error("Security dependency requirements are not satisfied.");
  process.exit(1);
}
