import re

def patch_file(file_path):
    with open(file_path, "r") as f:
        content = f.read()

    replacements = [
        ('bg-white', 'bg-white dark:bg-slate-800'),
        ('text-gray-600', 'text-gray-600 dark:text-slate-400'),
        ('text-gray-500', 'text-gray-500 dark:text-slate-500'),
        ('text-gray-400', 'text-gray-400 dark:text-slate-500'),
        ('text-[var(--color-cyc-secondary)]', 'text-[var(--color-cyc-secondary)] dark:text-slate-100'),
        ('border-gray-200', 'border-gray-200 dark:border-slate-700'),
        ('bg-gray-50', 'bg-gray-50 dark:bg-slate-900/50'),
        ('bg-green-50 text-green-700', 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'),
    ]

    for old, new in replacements:
        content = content.replace(old, new)

    with open(file_path, "w") as f:
        f.write(content)
    print("Patched " + file_path)

patch_file("src/app/thank-you/page.tsx")
