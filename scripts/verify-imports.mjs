#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const root = resolve(new URL("../", import.meta.url).pathname);
const srcRoot = join(root, "src");
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const declared = new Set([
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {}),
]);
const sourceExts = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const resolvableExts = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"];
const sources = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path);
    else if (sourceExts.has(extname(path))) sources.push(path);
  }
}
walk(srcRoot);

function resolveLocal(spec, from) {
  const base = spec.startsWith("@/")
    ? join(srcRoot, spec.slice(2))
    : resolve(dirname(from), spec);
  for (const suffix of resolvableExts) {
    const candidate = `${base}${suffix}`;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  for (const suffix of resolvableExts.slice(1)) {
    const candidate = join(base, `index${suffix}`);
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}
function packageRoot(spec) {
  if (spec.startsWith("node:")) return null;
  if (spec.startsWith("@")) return spec.split("/").slice(0, 2).join("/");
  return spec.split("/")[0];
}

const localEdges = [];
const brokenLocalImports = [];
const undeclaredExternalRoots = new Set();
const patterns = [
  /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/g,
  /\bimport\(\s*["']([^"']+)["']\s*\)/g,
];
for (const file of sources) {
  const text = readFileSync(file, "utf8");
  const specs = new Set();
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text))) specs.add(match[1]);
  }
  for (const spec of specs) {
    if (spec.startsWith(".") || spec.startsWith("@/")) {
      const target = resolveLocal(spec, file);
      if (target) localEdges.push([relative(root, file), relative(root, target)]);
      else brokenLocalImports.push({ file: relative(root, file), spec });
    } else {
      const pkg = packageRoot(spec);
      if (pkg && !declared.has(pkg)) undeclaredExternalRoots.add(pkg);
    }
  }
}

const report = {
  ok: brokenLocalImports.length === 0 && undeclaredExternalRoots.size === 0,
  sourceFiles: sources.length,
  localImportEdges: localEdges.length,
  brokenLocalImports,
  undeclaredExternalRoots: [...undeclaredExternalRoots].sort(),
};
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
