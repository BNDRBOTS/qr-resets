import test from "node:test";
import assert from "node:assert/strict";
import { validateUrlStructure } from "../src/lib/ssrf.ts";

const blocked = [
  ["http://127.0.0.1", "private-ip"],
  ["http://10.0.0.1", "private-ip"],
  ["http://172.16.0.1", "private-ip"],
  ["http://192.168.1.1", "private-ip"],
  ["http://169.254.169.254/latest/meta-data", "private-ip"],
  ["http://100.100.100.200", "private-ip"],
  ["http://[::1]", "private-ip"],
  ["http://[fd00:ec2::254]", "private-ip"],
  ["http://localhost", "blocked-host"],
  ["http://metadata.google.internal", "blocked-host"],
  ["http://user:password@example.com", "credentials-in-url"],
  ["ftp://example.com", "scheme-not-allowed"],
];

for (const [url, reason] of blocked) {
  test(`SSRF structure gate blocks ${url}`, () => {
    assert.deepEqual(validateUrlStructure(url), { ok: false, reason });
  });
}

test("SSRF structure gate allows an ordinary public HTTPS hostname", () => {
  assert.deepEqual(validateUrlStructure("https://example.com/path?q=1"), {
    ok: true,
    resolvedHost: "example.com",
  });
});
