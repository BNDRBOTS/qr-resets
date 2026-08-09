import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCsv,
  buildPrintDocument,
  csvCell,
  escapeHtml,
  neutralizeCsvFormula,
} from "../src/lib/export-safety.ts";

test("HTML output is escaped before print interpolation", () => {
  const hostile = `<img src=x onerror="alert(1)">&'`;
  assert.equal(
    escapeHtml(hostile),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;",
  );
  const html = buildPrintDocument("<script>title</script>", [
    {
      name: `<script>alert(1)</script>`,
      description: `<img src=x onerror=alert(2)>`,
      sourceNote: `"><svg onload=alert(3)>`,
    },
  ]);
  assert.equal(html.includes("<script>alert(1)</script>"), false);
  assert.equal(html.includes("<img src=x onerror=alert(2)>"), false);
  assert.equal(html.includes("<svg onload=alert(3)>"), false);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(2\)&gt;/);
});

test("CSV cells neutralize spreadsheet formulas before quoting", () => {
  for (const value of ["=2+2", "+cmd", "-10+20", "@SUM(A1:A2)", "   =1+1"]) {
    assert.equal(neutralizeCsvFormula(value).startsWith("'"), true, value);
  }
  assert.equal(neutralizeCsvFormula("safe text"), "safe text");
  const encoded = csvCell('=HYPERLINK("https://bad")');
  assert.equal(encoded.startsWith("\"'="), true);
  assert.equal(encoded.includes('\"\"https://bad\"\"'), true);
  const csv = buildCsv(["Name", "Note"], [["Example", "=WEBSERVICE(\"https://bad\")"]]);
  assert.match(csv, /'=/);
});
