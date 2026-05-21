import re

def patch_file(file_path):
    with open(file_path, "r") as f:
        content = f.read()

    # 1. Insert RichTextRenderer before SurveyPage
    renderer_code = """
const RichTextRenderer = ({ text, definitions }: { text: string; definitions?: { term: string; definition: string }[] }) => {
  if (!text) return null;
  if (!definitions || definitions.length === 0) return <>{text}</>;

  const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
  const sortedDefs = [...definitions].sort((a, b) => b.term.length - a.term.length);
  const pattern = new RegExp(`\\\\b(${sortedDefs.map(d => escapeRegExp(d.term)).join('|')})\\\\b`, 'gi');

  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) => {
        const def = sortedDefs.find(d => d.term.toLowerCase() === part.toLowerCase());
        if (def) {
          return (
            <div key={i} className="relative inline-block group cursor-help mx-1">
              <span className="font-bold underline decoration-wavy decoration-teal-400">{part}</span>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-xl z-50 text-center font-normal">
                {def.definition}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

export default function SurveyPage() {"""

    content = content.replace("export default function SurveyPage() {", renderer_code)

    # 2. Update question text rendering
    old_q_text = "                  {part}\n                </div>"
    new_q_text = "                  <RichTextRenderer text={part} definitions={opts.definitions} />\n                </div>"
    content = content.replace(old_q_text, new_q_text)

    # 3. Update section description rendering
    old_desc = "                      {opts.description}\n                    </p>"
    new_desc = "                      <RichTextRenderer text={opts.description} definitions={opts.definitions} />\n                    </p>"
    content = content.replace(old_desc, new_desc)

    with open(file_path, "w") as f:
        f.write(content)

patch_file("src/app/survey/[id]/page.tsx")
print("Survey Player Patched")
