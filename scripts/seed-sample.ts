// Seeds a small representative sample of 10 CFR Part 53 so the app can be exercised
// end-to-end while eCFR.gov has not yet populated the published rule body.
//
// IMPORTANT: paragraph text is clearly labeled SAMPLE and is NOT regulatory text.
// Subpart letters/titles are public structural facts about the rule.
// Replace this seed by running `npm run ingest` once eCFR has Part 53 content.

import { getRawDb, rebuildFts } from "../db/client";
import { extractRequirements } from "./extract-requirements";
import { extractXrefs } from "./extract-xrefs";
import { extractDefinition } from "./extract-definitions";

type SampleSection = {
  code: string;
  title: string;
  paragraphs: Array<{ designator: string | null; text: string }>;
};

type SampleSubpart = {
  code: string;
  title: string;
  sections: SampleSection[];
};

const SAMPLE: SampleSubpart[] = [
  {
    code: "A",
    title: "General Provisions",
    sections: [
      {
        code: "53.010",
        title: "Purpose",
        paragraphs: [
          {
            designator: null,
            text: "[SAMPLE] This part establishes a risk-informed, technology-inclusive regulatory framework for commercial nuclear plants. Replace via npm run ingest when eCFR.gov publishes Part 53 body content.",
          },
        ],
      },
      {
        code: "53.020",
        title: "Definitions",
        paragraphs: [
          {
            designator: null,
            text: "[SAMPLE] As used in this part:",
          },
          {
            designator: null,
            text: "Design features means structures, systems, and components, and their associated functional and performance requirements, that are credited in safety analyses.",
          },
          {
            designator: null,
            text: "Probabilistic Risk Assessment (PRA) means a systematic and comprehensive methodology to evaluate risks associated with a complex engineered technological entity such as a commercial nuclear plant.",
          },
          {
            designator: null,
            text: "Safety Functional Design Criteria refers to the principal design criteria that establish the necessary design, fabrication, construction, testing, and performance requirements for SSCs.",
          },
        ],
      },
    ],
  },
  {
    code: "B",
    title: "Technology-Inclusive Safety Requirements",
    sections: [
      {
        code: "53.210",
        title: "Safety objectives",
        paragraphs: [
          {
            designator: "(a)",
            text: "[SAMPLE] Each applicant or licensee subject to this part shall demonstrate that the commercial nuclear plant satisfies the safety criteria in § 53.220.",
          },
          {
            designator: "(b)",
            text: "[SAMPLE] The applicant must identify design features and programmatic controls in accordance with Subpart C and § 53.450.",
          },
        ],
      },
      {
        code: "53.220",
        title: "Safety criteria",
        paragraphs: [
          {
            designator: "(a)",
            text: "[SAMPLE] The applicant shall ensure that doses to a member of the public from any design-basis accident do not exceed the limits in 10 CFR Part 50, Appendix I.",
          },
          {
            designator: "(b)",
            text: "[SAMPLE] No licensee may operate a commercial nuclear plant in a manner that exceeds the bounding parameters of the safety analyses required by § 53.450.",
          },
        ],
      },
    ],
  },
  {
    code: "C",
    title: "Design and Analysis Requirements",
    sections: [
      {
        code: "53.450",
        title: "Safety analyses",
        paragraphs: [
          {
            designator: "(a)",
            text: "[SAMPLE] Applicants are required to perform deterministic and probabilistic safety analyses that demonstrate compliance with § 53.220.",
          },
          {
            designator: "(b)",
            text: "[SAMPLE] The PRA shall be developed in accordance with consensus standards endorsed by the NRC and shall consider all relevant operating modes.",
          },
        ],
      },
      {
        code: "53.460",
        title: "Design features",
        paragraphs: [
          {
            designator: null,
            text: "[SAMPLE] The applicant shall identify design features credited in the safety analyses required by § 53.450 and must establish corresponding functional and performance requirements.",
          },
        ],
      },
    ],
  },
  {
    code: "D",
    title: "Siting Requirements",
    sections: [
      {
        code: "53.610",
        title: "Site characteristics",
        paragraphs: [
          {
            designator: null,
            text: "[SAMPLE] The applicant must characterize site-specific hazards in accordance with 10 CFR 100.20 and shall demonstrate that the design features identified under § 53.460 remain effective for those hazards.",
          },
        ],
      },
    ],
  },
  {
    code: "E",
    title: "Construction and Manufacturing Requirements",
    sections: [
      {
        code: "53.710",
        title: "Quality assurance during construction",
        paragraphs: [
          {
            designator: null,
            text: "[SAMPLE] Each licensee shall implement a quality assurance program that satisfies the requirements of 10 CFR Part 50, Appendix B, as applied through Subpart H.",
          },
        ],
      },
    ],
  },
  {
    code: "F",
    title: "Requirements for Operation",
    sections: [
      {
        code: "53.810",
        title: "Operating procedures",
        paragraphs: [
          {
            designator: null,
            text: "[SAMPLE] Operators must follow procedures that preserve the design features credited in § 53.460 and are required to suspend operation if any safety criterion in § 53.220 is challenged.",
          },
        ],
      },
    ],
  },
  {
    code: "G",
    title: "Decommissioning Requirements",
    sections: [
      {
        code: "53.910",
        title: "Decommissioning planning",
        paragraphs: [
          {
            designator: null,
            text: "[SAMPLE] The licensee shall develop and maintain a decommissioning plan in accordance with 10 CFR 50.82 and Subpart G.",
          },
        ],
      },
    ],
  },
  {
    code: "H",
    title: "Licenses, Certifications, and Approvals",
    sections: [
      {
        code: "53.1010",
        title: "License application content",
        paragraphs: [
          {
            designator: null,
            text: "[SAMPLE] An application for a license under this part must include the safety analyses required by § 53.450, the PRA results, and the proposed technical specifications.",
          },
        ],
      },
    ],
  },
  {
    code: "I",
    title: "Maintenance, Surveillance, and Performance Testing",
    sections: [
      {
        code: "53.1110",
        title: "Maintenance program",
        paragraphs: [
          {
            designator: null,
            text: "[SAMPLE] The licensee shall implement a maintenance program that preserves the availability and reliability assumptions used in the PRA required by § 53.450.",
          },
        ],
      },
    ],
  },
  {
    code: "J",
    title: "Reporting and Other Administrative Requirements",
    sections: [
      {
        code: "53.1210",
        title: "Reportable events",
        paragraphs: [
          {
            designator: null,
            text: "[SAMPLE] The licensee shall report to the NRC, in accordance with Subpart J, any event that challenges the safety criteria in § 53.220 or invalidates the PRA assumptions in § 53.450.",
          },
        ],
      },
    ],
  },
];

function main() {
  const sqlite = getRawDb();
  const tx = sqlite.transaction(() => {
    sqlite.exec(`
      DELETE FROM cross_refs;
      DELETE FROM definitions;
      DELETE FROM requirements;
      DELETE FROM paragraphs;
      DELETE FROM sections;
      DELETE FROM subparts;
    `);

    const insSubpart = sqlite.prepare(`INSERT INTO subparts (code, title, ordinal) VALUES (?, ?, ?)`);
    const insSection = sqlite.prepare(
      `INSERT INTO sections (subpart_id, code, title, ordinal) VALUES (?, ?, ?, ?)`,
    );
    const insParagraph = sqlite.prepare(
      `INSERT INTO paragraphs (section_id, designator, depth, parent_id, text_html, text_plain, ordinal)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const insRequirement = sqlite.prepare(
      `INSERT INTO requirements (paragraph_id, section_id, modal, text) VALUES (?, ?, ?, ?)`,
    );
    const insXref = sqlite.prepare(
      `INSERT INTO cross_refs (source_paragraph_id, source_section_id, target_kind, target_section_code, target_label, raw)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const insDef = sqlite.prepare(
      `INSERT OR IGNORE INTO definitions (term, paragraph_id, section_id, text) VALUES (?, ?, ?, ?)`,
    );
    const insRun = sqlite.prepare(
      `INSERT INTO ingest_runs (source_date, amendment_date, paragraph_count, section_count, subpart_count, completed_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );

    let totalParagraphs = 0;
    let totalSections = 0;

    SAMPLE.forEach((sp, i) => {
      const subpartId = insSubpart.run(sp.code, sp.title, i + 1).lastInsertRowid as number;
      sp.sections.forEach((sec, j) => {
        const sectionId = insSection.run(subpartId, sec.code, sec.title, j + 1).lastInsertRowid as number;
        totalSections++;
        sec.paragraphs.forEach((para, k) => {
          const depth = para.designator ? (para.designator.match(/\(/g) ?? []).length : 0;
          const paragraphId = insParagraph.run(
            sectionId,
            para.designator,
            depth,
            null,
            para.text,
            para.text,
            k + 1,
          ).lastInsertRowid as number;
          totalParagraphs++;
          for (const req of extractRequirements(para.text)) {
            insRequirement.run(paragraphId, sectionId, req.modal, req.text);
          }
          for (const xr of extractXrefs(para.text)) {
            insXref.run(paragraphId, sectionId, xr.targetKind, xr.targetSectionCode, xr.targetLabel, xr.raw);
          }
          if (sp.code === "A") {
            const def = extractDefinition(para.text);
            if (def) insDef.run(def.term, paragraphId, sectionId, def.text);
          }
        });
      });
    });

    insRun.run("seed-sample", null, totalParagraphs, totalSections, SAMPLE.length, Date.now());
    console.log(
      `seeded ${SAMPLE.length} subparts, ${totalSections} sections, ${totalParagraphs} paragraphs (SAMPLE — replace via npm run ingest)`,
    );
  });
  tx();
  rebuildFts();
  console.log("FTS rebuilt; sample seed complete.");
}

main();
