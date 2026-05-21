import re

def patch_file(file_path):
    with open(file_path, "r") as f:
        content = f.read()

    # The block ends with "optionsPayload = { description: q.section_description || '', attachments: q.attachments || [], description_alignment: q.description_alignment || 'left' };\n          }"
    # I want to add definitions logic after this block, before "return {"

    old_text = "          }\n          return {"
    new_text = "          }\n          if (q.definitions && q.definitions.length > 0) {\n            if (!optionsPayload) optionsPayload = {};\n            optionsPayload.definitions = q.definitions;\n          }\n          return {"
    
    if old_text in content:
        content = content.replace(old_text, new_text)
        with open(file_path, "w") as f:
            f.write(content)
        print(f"Patched {file_path}")
    else:
        print(f"Failed to find hook in {file_path}")

patch_file("src/app/admin/create/page.tsx")
patch_file("src/app/admin/edit/[id]/page.tsx")
