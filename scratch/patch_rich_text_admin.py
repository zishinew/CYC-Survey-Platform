import re

def patch_file(file_path):
    with open(file_path, "r") as f:
        content = f.read()

    # Import
    if "import { RichTextEditor }" not in content:
        content = content.replace("import Link from 'next/link';", "import Link from 'next/link';\nimport { RichTextEditor } from '@/components/RichTextEditor';")

    # Replace question_text input
    # Look for:
    # <input type="text" required value={q.question_text}
    #   onChange={(e) => updateQuestion(q.id, 'question_text', e.target.value)}
    #   className="flex-grow p-2 border rounded font-semibold text-gray-800 focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none"
    #   placeholder={q.type === 'section_header' ? 'Section Title' : 'Type your question here...'} />
    
    # We can use regex to replace it
    q_text_pattern = re.compile(r'<input type="text" required value=\{q\.question_text\}.*?placeholder=\{.*?\} />', re.DOTALL)
    new_q_text = """<div className="flex-grow">
                  <RichTextEditor
                    value={q.question_text}
                    onChange={(val) => updateQuestion(q.id, 'question_text', val)}
                    placeholder={q.type === 'section_header' ? 'Section Title' : 'Type your question here...'}
                  />
                </div>"""
    
    content = q_text_pattern.sub(new_q_text, content)

    # Replace section_description textarea
    # Look for:
    # <textarea rows={3} value={q.section_description || ''}
    #   onChange={(e) => updateQuestion(q.id, 'section_description', e.target.value)}
    #   className="w-full p-2 border rounded focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none text-sm"
    #   placeholder="Provide context or instructions before the next set of questions..." />
    desc_pattern = re.compile(r'<textarea rows=\{3\} value=\{q\.section_description \|\| \'\'\}.*?placeholder="Provide context or instructions before the next set of questions\.\.\." />', re.DOTALL)
    new_desc = """<RichTextEditor
                        value={q.section_description || ''}
                        onChange={(val) => updateQuestion(q.id, 'section_description', val)}
                        placeholder="Provide context or instructions before the next set of questions..."
                      />"""
    content = desc_pattern.sub(new_desc, content)

    with open(file_path, "w") as f:
        f.write(content)
    print(f"Patched {file_path}")

patch_file("src/app/admin/create/page.tsx")
patch_file("src/app/admin/edit/[id]/page.tsx")
