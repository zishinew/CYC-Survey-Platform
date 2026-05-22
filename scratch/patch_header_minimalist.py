import re

def patch_file(file_path):
    with open(file_path, "r") as f:
        content = f.read()

    # 1. Fix the header background and border
    # From: <header className="flex-shrink-0 z-50 bg-white dark:bg-slate-900 shadow-sm h-16 sm:h-20 border-b border-transparent dark:border-slate-800 transition-colors duration-300">
    content = content.replace('dark:bg-slate-900 shadow-sm h-16 sm:h-20 border-b border-transparent dark:border-slate-800', 'dark:bg-[#0a0a0a] h-16 sm:h-20 border-b border-gray-100 dark:border-white/10')
    
    # 2. Subdue the cyan stripe
    # From: <div className="h-1.5 w-full bg-[var(--color-cyc-primary)]" />
    content = content.replace('<div className="h-1.5 w-full bg-[var(--color-cyc-primary)]" />', '<div className="h-1 w-full bg-[var(--color-cyc-primary)] dark:bg-white/5" />')

    # 3. Logo
    # From: drop-shadow-md dark:brightness-110
    content = content.replace('drop-shadow-md dark:brightness-110', 'dark:brightness-110')

    with open(file_path, "w") as f:
        f.write(content)
    print("Patched " + file_path)

patch_file("src/components/layout/HeaderFooter.tsx")
