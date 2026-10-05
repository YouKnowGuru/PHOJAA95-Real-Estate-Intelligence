/**
 * Runtime smoke test for the clients + email routers.
 * Exercises CRUD, CSV import, property search, preview and history against
 * the live database using a synthetic admin context (no real email is sent).
 * Run: npx tsx scripts/smoke-email-routers.ts
 */
import "dotenv/config";
import { clientRouter } from "../api/client-router";
import { emailRouter } from "../api/email-router";
import type { TrpcContext } from "../api/context";

const ctx: TrpcContext = {
  req: new Request("http://localhost"),
  resHeaders: new Headers(),
  unifiedUser: {
    id: 1,
    name: "Smoke Test",
    email: null,
    role: "admin",
    authType: "local",
    status: "active",
  },
};

const clients = clientRouter.createCaller(ctx);
const email = emailRouter.createCaller(ctx);

const results: Array<[string, boolean, string]> = [];
function record(name: string, ok: boolean, detail = "") {
  results.push([name, ok, detail]);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

const TEST_EMAIL = "smoke-test-client@example.com";
let createdId: number | null = null;

async function main() {
  // 1. SMTP status (no send)
  const status = await email.status();
  record("email.status", typeof status.configured === "boolean", JSON.stringify(status));

  // 2. Empty-ish client list query
  const list = await clients.list({});
  record("clients.list", Array.isArray(list.rows), `${list.total} clients total`);

  // 3. Create
  const created = await clients.create({
    fullName: "Smoke Test Client",
    email: TEST_EMAIL,
    phone: "171234567",
    groupName: "Testing",
    notes: "created by smoke test",
  });
  createdId = created?.id ?? null;
  record("clients.create", Boolean(createdId), `id=${createdId}`);

  // 4. Duplicate rejected
  let dupRejected = false;
  try {
    await clients.create({ fullName: "Dupe", email: TEST_EMAIL });
  } catch {
    dupRejected = true;
  }
  record("clients.create duplicate rejected", dupRejected);

  // 5. Groups
  const groups = await clients.groups();
  record("clients.groups", groups.includes("Testing"), groups.join(", "));

  // 6. Filtered list
  const filtered = await clients.list({ search: "smoke", group: "Testing" });
  record(
    "clients.list filtered",
    filtered.rows.some((r) => r.id === createdId),
    `${filtered.rows.length} rows`,
  );

  // 7. Update
  const updated = await clients.update({
    id: createdId!,
    fullName: "Smoke Test Client (edited)",
    email: TEST_EMAIL,
    phone: "171234567",
    groupName: "Testing",
    notes: "edited",
  });
  record("clients.update", updated?.fullName === "(edited)" || updated?.fullName.endsWith("(edited)"), updated?.fullName);

  // 8. Status toggle
  await clients.setStatus({ id: createdId!, status: "unsubscribed" });
  const unsub = await clients.list({ status: "unsubscribed", search: "smoke" });
  await clients.setStatus({ id: createdId!, status: "active" });
  record("clients.setStatus", unsub.rows.some((r) => r.id === createdId));

  // 9. CSV import (1 duplicate against DB, 1 dup within batch, 1 new)
  const importRes = await clients.importCsv({
    rows: [
      { fullName: "CSV Existing", email: TEST_EMAIL, phone: "", groupName: "CSV" },
      { fullName: "CSV New", email: "csv-new@example.com", phone: "170000001", groupName: "CSV" },
      { fullName: "CSV New dup", email: "csv-new@example.com", phone: "", groupName: "CSV" },
    ],
  });
  record(
    "clients.importCsv",
    importRes.imported === 1 && importRes.duplicatesInFile === 1 && importRes.skipped === 1,
    JSON.stringify(importRes),
  );

  // 10. Property search + full property load
  const props = await email.searchProperties({});
  record("email.searchProperties", Array.isArray(props) && props.length > 0, `${props.length} properties`);
  const coverOk = props[0] ? "price" in props[0] : false;
  record("email.searchProperties shape", coverOk);

  if (props.length) {
    const prop = await email.getProperty({ id: props[0].id });
    record("email.getProperty", Boolean(prop?.name), prop?.name ?? "");
    record(
      "email.getProperty images",
      Boolean(prop),
      `${prop?.imageUrls?.length ?? 0} image(s), price=${prop?.price}`,
    );

    // 11. Preview render (no send)
    const preview = await email.preview({
      subject: "Smoke — {{propertyName}} at Nu. {{price}}",
      body: "Hello {{clientName}},\n\nSmoke test body with {{address}}.",
      propertyId: props[0].id,
      includeProperty: true,
      sampleName: "Pema Wangmo",
    });
    const htmlOk =
      preview.html.includes("<html") &&
      !preview.html.includes("{{") &&
      preview.html.includes("Pema Wangmo");
    record("email.preview", htmlOk, `subject="${preview.subject}", ${preview.html.length} bytes`);
  }

  // 12. History query (reads email_logs table)
  const history = await email.history({});
  record("email.history", Array.isArray(history), `${history.length} log rows`);

  // Cleanup
  if (createdId) {
    await clients.delete({ id: createdId });
    record("clients.delete (cleanup)", true);
  }
  const csvClient = await clients.list({ search: "csv-new@example.com" });
  for (const row of csvClient.rows) {
    if (row.email === "csv-new@example.com") await clients.delete({ id: row.id });
  }
  record("cleanup csv client", true);
}

main()
  .catch((err) => {
    record("unhandled error", false, err instanceof Error ? err.stack ?? err.message : String(err));
  })
  .finally(() => {
    const failed = results.filter(([, ok]) => !ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    if (failed.length) {
      failed.forEach(([name, , detail]) => console.log(`  FAILED: ${name} — ${detail}`));
      process.exit(1);
    }
    process.exit(0);
  });
