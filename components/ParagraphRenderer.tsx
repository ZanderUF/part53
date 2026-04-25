import type { Paragraph } from "@/db/queries";
import { renderInlineRefs } from "./XrefBadge";

export function ParagraphRenderer({
  paragraphs,
  knownSectionCodes,
}: {
  paragraphs: Paragraph[];
  knownSectionCodes: Set<string>;
}) {
  return (
    <div className="regtext text-[17px]">
      {paragraphs.map((p) => (
        <p
          key={p.id}
          id={`p-${p.id}`}
          style={{ paddingLeft: `${p.depth * 1.5}rem` }}
          className="group relative"
        >
          {p.designator && (
            <span className="font-semibold text-slate-700 mr-1">{p.designator}</span>
          )}
          {renderInlineRefs(p.text_plain, knownSectionCodes)}
        </p>
      ))}
    </div>
  );
}
