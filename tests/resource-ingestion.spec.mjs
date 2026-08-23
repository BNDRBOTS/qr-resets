import test from "node:test";
import assert from "node:assert/strict";
import {
  ResourceDocumentError,
  canonicalizeResourceCandidate,
  classifyResourceViability,
  findBatchDuplicate,
  gateResourcePublication,
  parseResourceDocument,
  resourceIdentityKeys,
  tolerantResourceMapping,
  validateContactCandidates,
} from "../src/lib/resource-ingestion-core.mjs";

const expected = {
  name: "Arizona Victim Help",
  category: "victim-rights-compensation",
  email: "help@example.org",
  website: "https://example.org",
};

const documents = {
  txt: `Name: Arizona Victim Help\nCategory: victim rights\nEmail: help@example.org\nWebsite: example.org\nPhone: (602) 555-0199`,
  markdown: `# Arizona Victim Help\n\nCategory: victim rights\n\nEmail: help@example.org\n\nWebsite: https://example.org\n\nPhone: (602) 555-0199`,
  json: JSON.stringify({ resources: [{ organization_name: "Arizona Victim Help", type: "victim rights", email_address: "help@example.org", url: "example.org", telephone: "(602) 555-0199" }] }),
  xml: `<resources><resource><organization_name>Arizona Victim Help</organization_name><type>victim rights</type><email_address>help@example.org</email_address><url>example.org</url><telephone>(602) 555-0199</telephone></resource></resources>`,
};

for (const [format, content] of Object.entries(documents)) {
  test(`${format} parser converges on the Resource fields`, () => {
    const document = parseResourceDocument(content, format, { multiple: true });
    assert.equal(document.candidates.length, 1);
    const { canonical } = canonicalizeResourceCandidate(document.candidates[0]);
    const validated = validateContactCandidates(canonical);
    assert.deepEqual(
      {
        name: validated.canonical.name,
        category: validated.canonical.category,
        email: validated.canonical.email,
        website: validated.canonical.website,
      },
      expected,
    );
    assert.equal(validated.phoneNormalized, "6025550199");
    assert.deepEqual(validated.issues, []);
  });
}

test("malformed structured inputs stop before candidates exist", () => {
  assert.throws(
    () => parseResourceDocument('{"resources":[', "json", { multiple: true }),
    (error) => error instanceof ResourceDocumentError && error.code === "MALFORMED_JSON",
  );
  assert.throws(
    () => parseResourceDocument("<resources><resource>", "xml", { multiple: true }),
    (error) => error instanceof ResourceDocumentError && error.code === "NO_RESOURCE_CANDIDATES",
  );
});

test("dedupe requires an exact name plus contact identity and never name alone", () => {
  const first = {
    identityKeys: resourceIdentityKeys({ name: "Shared Name", website: "https://one.example/help", email: null }, null),
  };
  const exact = {
    identityKeys: resourceIdentityKeys({ name: "Shared Name", website: "https://one.example/help", email: null }, null),
  };
  const distinctContact = {
    identityKeys: resourceIdentityKeys({ name: "Shared Name", website: "https://two.example/help", email: null }, null),
  };
  const distinctName = {
    identityKeys: resourceIdentityKeys({ name: "Different Name", website: "https://one.example/help", email: null }, null),
  };
  assert.deepEqual(findBatchDuplicate([first, exact]), {
    key: first.identityKeys[0],
    firstIndex: 0,
    secondIndex: 1,
  });
  assert.equal(findBatchDuplicate([first, distinctContact]), null);
  assert.equal(findBatchDuplicate([first, distinctName]), null);
});

test("invalid contact candidates are removed and classify as invalid", () => {
  const mapped = tolerantResourceMapping({
    name: "Bad Contact",
    category: "victim-rights-compensation",
    email: "not-an-email",
    website: "http://[",
    phone: "123",
  });
  const { canonical, signals } = canonicalizeResourceCandidate(mapped);
  const validated = validateContactCandidates(canonical);
  assert.equal(validated.canonical.email, null);
  assert.equal(validated.canonical.website, null);
  assert.equal(validated.phoneNormalized, null);
  assert.deepEqual(validated.issues.sort(), ["invalid_email", "invalid_phone", "invalid_url"]);
  assert.equal(classifyResourceViability({ signals, issues: validated.issues, hasContact: false }), "invalid");
});

test("viability gates invalid, off-topic, identity mismatch, and uncertainty", () => {
  const base = { status: "", identityMismatch: false, offTopic: false, httpStatus: null };
  assert.equal(classifyResourceViability({ signals: base, issues: [], hasContact: false }), "pending");
  assert.equal(classifyResourceViability({ signals: { ...base, status: "invalid" }, issues: [], hasContact: true }), "invalid");
  assert.equal(classifyResourceViability({ signals: { ...base, offTopic: true }, issues: [], hasContact: true }), "off_topic");
  assert.equal(classifyResourceViability({ signals: { ...base, identityMismatch: true }, issues: [], hasContact: true }), "identity_mismatch");
});

test("HTTP 200 never promotes an entity to verified or published", () => {
  assert.deepEqual(
    gateResourcePublication({
      viability: "viable",
      requestedVerified: true,
      requestedPublished: true,
      httpStatus: 200,
    }),
    { verified: false, published: false },
  );
});

test("non-viable entities remain unverified and unpublished", () => {
  for (const viability of ["pending", "invalid", "off_topic", "identity_mismatch"]) {
    assert.deepEqual(
      gateResourcePublication({ viability, requestedVerified: true, requestedPublished: true }),
      { verified: false, published: false },
    );
  }
});
