import re

def patch_file(file_path):
    with open(file_path, "r") as f:
        content = f.read()

    # Generic background/text fixes for Survey UI
    replacements = [
        # Main card
        ('bg-white rounded-2xl md:rounded-3xl shadow-xl overflow-hidden', 'bg-white dark:bg-slate-800 rounded-2xl md:rounded-3xl shadow-xl overflow-hidden border border-transparent dark:border-slate-700'),
        
        # Header/Nav
        ('bg-gray-50/50 backdrop-blur-sm border-b', 'bg-gray-50/50 dark:bg-slate-800/80 backdrop-blur-sm border-b dark:border-slate-700'),
        ('text-gray-500 hover:text-gray-800', 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'),
        
        # Email Step
        ('text-gray-600 font-medium mb-6', 'text-gray-600 dark:text-slate-400 font-medium mb-6'),
        ('border-2 border-gray-200 rounded-xl focus:border-[var(--color-cyc-primary)] focus:ring-4 focus:ring-teal-50', 'border-2 border-gray-200 dark:border-slate-600 bg-transparent dark:bg-slate-900 rounded-xl focus:border-[var(--color-cyc-primary)] focus:ring-4 focus:ring-[var(--color-cyc-primary)]/20 dark:text-white'),
        ('text-gray-400 text-center mt-3', 'text-gray-400 dark:text-slate-500 text-center mt-3'),
        
        # Questions / Text
        ('text-gray-600 font-medium', 'text-gray-600 dark:text-slate-300 font-medium'),
        ('text-gray-600 leading-relaxed', 'text-gray-600 dark:text-slate-300 leading-relaxed'),
        ('text-gray-400 font-medium mb-4', 'text-gray-400 dark:text-slate-500 font-medium mb-4'),
        
        # Options - Multiple Choice / Checkbox
        ('bg-white border-2 border-gray-200 hover:border-[var(--color-cyc-primary)] hover:bg-teal-50', 'bg-white dark:bg-slate-800 border-2 border-gray-200 dark:border-slate-700 hover:border-[var(--color-cyc-primary)] hover:bg-teal-50 dark:hover:bg-slate-700'),
        ('border-[var(--color-cyc-primary)] bg-teal-50/30', 'border-[var(--color-cyc-primary)] bg-teal-50/30 dark:bg-[var(--color-cyc-primary)]/10'),
        ('text-gray-700 font-medium', 'text-gray-700 dark:text-slate-200 font-medium'),
        
        # Option - 'Other' Text input
        ('border-b-2 border-gray-300 focus:border-[var(--color-cyc-primary)]', 'border-b-2 border-gray-300 dark:border-slate-600 dark:bg-transparent dark:text-white focus:border-[var(--color-cyc-primary)]'),
        
        # Dropdown
        ('border-2 border-gray-200 rounded-xl bg-white focus:border-[var(--color-cyc-primary)] focus:ring-4 focus:ring-teal-50', 'border-2 border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 dark:text-white focus:border-[var(--color-cyc-primary)] focus:ring-4 focus:ring-[var(--color-cyc-primary)]/20'),
        
        # Rating Scale
        ('bg-gray-100 text-gray-600 hover:bg-gray-200', 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'),
        ('bg-[var(--color-cyc-primary)] text-white shadow-md transform scale-110', 'bg-[var(--color-cyc-primary)] text-white shadow-md transform scale-110'),
        
        # Open Ended
        ('p-4 border-2 border-gray-200 rounded-xl focus:border-[var(--color-cyc-primary)] focus:ring-4 focus:ring-teal-50', 'p-4 border-2 border-gray-200 dark:border-slate-700 bg-transparent dark:bg-slate-900 rounded-xl focus:border-[var(--color-cyc-primary)] focus:ring-4 focus:ring-[var(--color-cyc-primary)]/20 dark:text-white'),
        
        # Date Picker
        ('p-3 border-2 border-gray-200 rounded-xl focus:border-[var(--color-cyc-primary)] focus:ring-4 focus:ring-teal-50', 'p-3 border-2 border-gray-200 dark:border-slate-700 bg-transparent dark:bg-slate-900 rounded-xl focus:border-[var(--color-cyc-primary)] focus:ring-4 focus:ring-[var(--color-cyc-primary)]/20 dark:text-white'),
        
        # Matrix Table
        ('min-w-full border-collapse', 'min-w-full border-collapse dark:text-slate-200'),
        ('bg-gray-50', 'bg-gray-50 dark:bg-slate-800'),
        ('border-b border-gray-200', 'border-b border-gray-200 dark:border-slate-700'),
        ('bg-white hover:bg-gray-50', 'bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800'),
        ('text-gray-600', 'text-gray-600 dark:text-slate-400'),
        
        # Next / Prev buttons footer
        ('bg-gray-50/50 backdrop-blur-sm border-t p-4', 'bg-gray-50/50 dark:bg-slate-800/80 backdrop-blur-sm border-t dark:border-slate-700 p-4'),
        ('text-gray-500 hover:text-[var(--color-cyc-primary)]', 'text-gray-500 dark:text-slate-400 hover:text-[var(--color-cyc-primary)]'),
        ('text-gray-300 cursor-not-allowed', 'text-gray-300 dark:text-slate-600 cursor-not-allowed'),
        ('text-gray-600 font-medium hidden sm:block', 'text-gray-600 dark:text-slate-400 font-medium hidden sm:block'),

        # Tooltip styling
        ('bg-gray-900 text-white', 'bg-gray-900 dark:bg-slate-100 text-white dark:text-slate-900'),
        ('border-t-gray-900', 'border-t-gray-900 dark:border-t-slate-100'),
        
        # Attachment
        ('bg-white', 'bg-white dark:bg-slate-800'),
    ]

    for old, new in replacements:
        content = content.replace(old, new)

    # Some targeted fixes using regex because they might have slight variations
    content = re.sub(r'text-gray-600 mb-6', 'text-gray-600 dark:text-slate-400 mb-6', content)
    content = re.sub(r'text-\[var\(--color-cyc-secondary\)\]', 'text-[var(--color-cyc-secondary)] dark:text-slate-100', content)

    with open(file_path, "w") as f:
        f.write(content)
    print("Patched " + file_path)

patch_file("src/app/survey/[id]/page.tsx")
