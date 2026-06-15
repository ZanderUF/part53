import { getRawDb } from "../db/client";
import { ingestPart } from "./ingest-fr";
import { ingestPartFromEcfr } from "./ingest-ecfr";

// Federal Register final-rule parts vs. established parts sourced from eCFR.
const FR_PARTS = ["53", "57"];
const ECFR_PARTS = ["50", "52"];
const ALL_PARTS = [...FR_PARTS, ...ECFR_PARTS];

async function main() {
  const db = getRawDb();
  const existingParts = new Set(
    (db.prepare("SELECT part_number FROM parts").all() as { part_number: string }[]).map(
      (r) => r.part_number,
    ),
  );

  const missing = ALL_PARTS.filter((p) => !existingParts.has(p));

  if (missing.length === 0) {
    console.log(
      `All parts already loaded (${ALL_PARTS.join(", ")}). Run \`npm run ingest\` to force a refresh.`,
    );
    return;
  }

  for (const part of missing) {
    console.log(`\nIngesting Part ${part}…`);
    if (ECFR_PARTS.includes(part)) await ingestPartFromEcfr(part);
    else await ingestPart(part);
  }

  console.log("\nSetup complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
