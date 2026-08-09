#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";

const root = resolve(new URL("../", import.meta.url).pathname);
const require = createRequire(import.meta.url);
let ts;
try {
  ts = require("typescript");
} catch {
  try {
    const globalRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
    ts = require(join(globalRoot, "typescript"));
  } catch {
    console.error("TypeScript compiler API is unavailable");
    process.exit(2);
  }
}

const files = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if ([".ts", ".tsx"].includes(extname(p))) files.push(p);
  }
}
walk(join(root, "src"));
for (const p of [join(root, "next.config.ts"), join(root, "tailwind.config.ts")]) {
  if (existsSync(p)) files.push(p);
}

const diagnostics = [];
for (const file of files) {
  const source = readFileSync(file, "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.Preserve,
      isolatedModules: true,
    },
    fileName: file,
    reportDiagnostics: true,
  });
  for (const d of result.diagnostics ?? []) {
    if (d.category !== ts.DiagnosticCategory.Error) continue;
    let line = null;
    let column = null;
    if (d.file && typeof d.start === "number") {
      const lc = d.file.getLineAndCharacterOfPosition(d.start);
      line = lc.line + 1;
      column = lc.character + 1;
    }
    diagnostics.push({
      file: relative(root, file),
      code: d.code,
      line,
      column,
      message: ts.flattenDiagnosticMessageText(d.messageText, " "),
    });
  }
}
const report = { ok: diagnostics.length === 0, files: files.length, diagnostics };
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
