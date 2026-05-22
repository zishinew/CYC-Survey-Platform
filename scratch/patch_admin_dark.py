import re

def patch_file(file_path):
    with open(file_path, "r") as f:
        content = f.read()

    replacements = [
        # Cards
        ('bg-white', 'bg-white dark:bg-slate-800'),
        ('text-gray-900', 'text-gray-900 dark:text-slate-100'),
        ('text-gray-800', 'text-gray-800 dark:text-slate-200'),
        ('text-gray-700', 'text-gray-700 dark:text-slate-300'),
        ('text-gray-600', 'text-gray-600 dark:text-slate-400'),
        ('text-gray-500', 'text-gray-500 dark:text-slate-500'),
        ('text-gray-400', 'text-gray-400 dark:text-slate-500'),
        ('text-[var(--color-cyc-secondary)]', 'text-[var(--color-cyc-secondary)] dark:text-slate-100'),
        
        # Borders and Backgrounds
        ('border-gray-200', 'border-gray-200 dark:border-slate-700'),
        ('border-gray-300', 'border-gray-300 dark:border-slate-600'),
        ('bg-gray-50', 'bg-gray-50 dark:bg-slate-900/50'),
        ('bg-gray-100', 'bg-gray-100 dark:bg-slate-700'),
        ('bg-gray-200', 'bg-gray-200 dark:bg-slate-600'),
        
        # specific to cards with custom borders
        ('card p-6 border-l-4 shadow-sm relative group border-l-[var(--color-cyc-accent)] bg-yellow-50/30', 'card p-6 border-l-4 shadow-sm relative group border-l-[var(--color-cyc-accent)] bg-yellow-50/30 dark:bg-[var(--color-cyc-accent)]/10 dark:border-r dark:border-y dark:border-slate-700'),
        ('card p-6 border-l-4 shadow-sm relative group border-l-[var(--color-cyc-primary)]', 'card p-6 border-l-4 shadow-sm relative group border-l-[var(--color-cyc-primary)] dark:border-r dark:border-y dark:border-slate-700 dark:bg-slate-800'),
        
        # text inputs
        ('w-full p-2 border rounded focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none', 'w-full p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none'),
        ('w-16 p-1 border rounded focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none text-center', 'w-16 p-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none text-center'),
        ('flex-grow p-2 border rounded text-sm focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none', 'flex-grow p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none'),
    ]

    for old, new in replacements:
        content = content.replace(old, new)

    with open(file_path, "w") as f:
        f.write(content)
    print("Patched " + file_path)

patch_file("src/app/admin/page.tsx")
patch_file("src/app/admin/create/page.tsx")
patch_file("src/app/admin/edit/[id]/page.tsx")
patch_file("src/components/RichTextEditor.tsx")
