import re

def patch_file(file_path):
    with open(file_path, "r") as f:
        content = f.read()

    # Import html-react-parser
    if "import parse from 'html-react-parser';" not in content:
        content = content.replace("import { ArrowRight, CheckCircle2, FileText, Download } from 'lucide-react';", "import { ArrowRight, CheckCircle2, FileText, Download } from 'lucide-react';\nimport parse, { domToReact, Element, Text } from 'html-react-parser';")

    old_renderer = """const RichTextRenderer = ({ text, definitions }: { text: string; definitions?: { term: string; definition: string }[] }) => {
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
              <span className="animated-wavy-underline">{part}</span>
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
};"""

    new_renderer = """const RichTextRenderer = ({ text, definitions }: { text: string; definitions?: { term: string; definition: string }[] }) => {
  if (!text) return null;
  if (!definitions || definitions.length === 0) return <>{parse(text)}</>;

  const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
  const sortedDefs = [...definitions].sort((a, b) => b.term.length - a.term.length);
  const pattern = new RegExp(`\\\\b(${sortedDefs.map(d => escapeRegExp(d.term)).join('|')})\\\\b`, 'gi');

  const options = {
    replace: (domNode: any) => {
      if (domNode.type === 'text') {
        const parts = domNode.data.split(pattern);
        if (parts.length === 1) return undefined; // No match, let parser handle it

        return (
          <>
            {parts.map((part: string, i: number) => {
              const def = sortedDefs.find(d => d.term.toLowerCase() === part.toLowerCase());
              if (def) {
                return (
                  <span key={i} className="relative inline-block group cursor-help mx-1">
                    <span className="animated-wavy-underline">{part}</span>
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-xl z-50 text-center font-normal tracking-normal leading-normal">
                      {def.definition}
                      <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></span>
                    </span>
                  </span>
                );
              }
              return <span key={i}>{part}</span>;
            })}
          </>
        );
      }
    }
  };

  return <>{parse(text, options)}</>;
};"""

    if old_renderer in content:
        content = content.replace(old_renderer, new_renderer)
        with open(file_path, "w") as f:
            f.write(content)
        print("Patched " + file_path)
    else:
        print("Failed to find hook in " + file_path)

patch_file("src/app/survey/[id]/page.tsx")
