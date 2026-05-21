def fix_import(file_path):
    with open(file_path, "r") as f: content = f.read()
    content = content.replace("} Lock, Unlock }", ", Lock, Unlock }")
    with open(file_path, "w") as f: f.write(content)

fix_import("src/app/admin/create/page.tsx")
fix_import("src/app/admin/edit/[id]/page.tsx")
