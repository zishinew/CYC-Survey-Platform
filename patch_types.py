import re

files = [
    "src/app/admin/create/page.tsx",
    "src/app/admin/edit/[id]/page.tsx",
]

for file_path in files:
    with open(file_path, "r") as f:
        content = f.read()

    old_type = """  question_text_fr?: string;
  options_fr?: any;
  section_description_fr?: string;
  definitions_fr?: any;
}"""

    new_type = """  question_text_fr?: string;
  options_fr?: any;
  section_description_fr?: string;
  definitions_fr?: any;
  question_text_zh?: string;
  options_zh?: any;
  section_description_zh?: string;
  definitions_zh?: any;
}"""
    if "question_text_zh" not in content:
        content = content.replace(old_type, new_type)

    with open(file_path, "w") as f:
        f.write(content)

print("types patched")
