import re

def patch_file(file_path):
    with open(file_path, "r") as f:
        content = f.read()

    # 1. Update the main container background (remove the CSS var background since body handles it)
    content = content.replace('bg-[var(--color-cyc-bg)]', 'bg-transparent')

    # 2. Update the Brand Section (Logo size, Title size, Description size/color)
    # Logo: w-48 md:w-64 -> w-64 md:w-96
    content = content.replace('w-48 md:w-64', 'w-64 md:w-96')
    # Title: text-3xl md:text-5xl font-black -> text-5xl md:text-7xl lg:text-8xl font-black
    content = content.replace('text-3xl md:text-5xl font-black text-[var(--color-cyc-secondary)]', 'text-5xl md:text-7xl lg:text-8xl font-black text-slate-900 dark:text-white')
    # Pulse cursor height: h-10 -> h-16
    content = content.replace('h-10 bg-[var(--color-cyc-primary)] ml-1', 'h-12 md:h-20 bg-[var(--color-cyc-primary)] ml-2')
    # Description: max-w-3xl -> max-w-5xl, text-base md:text-lg -> text-sm md:text-base, dark:text-slate-300 -> dark:text-[#888]
    content = content.replace('max-w-3xl', 'max-w-5xl')
    content = content.replace('text-base md:text-lg text-[var(--color-cyc-text-body)]', 'text-sm md:text-base text-gray-600 dark:text-[#888]')

    # 3. Update the Carousel Cards
    # From: bg-white dark:bg-slate-800 ...
    # Active: border-[var(--color-cyc-primary)] shadow-[0_20px_50px_rgba(12,183,196,0.2)]
    # Inactive: border-transparent dark:border-slate-700
    
    # We want to replace the dynamic class logic
    old_card_classes = """`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 border-2 ${item.position === 'center' ? 'border-[var(--color-cyc-primary)] shadow-[0_20px_50px_rgba(12,183,196,0.2)]' : 'border-transparent dark:border-slate-700'}`"""
    new_card_classes = """`bg-white dark:bg-[#111] rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 border border-gray-200 dark:border-[#222] ${item.position === 'center' ? 'dark:border-[var(--color-cyc-primary)] dark:shadow-[0_0_40px_rgba(12,183,196,0.3)] shadow-[0_20px_50px_rgba(12,183,196,0.2)]' : 'shadow-none'}`"""
    content = content.replace(old_card_classes, new_card_classes)

    # 4. Update the text colors inside the cards
    content = content.replace('dark:text-slate-100 mb-2', 'dark:text-white mb-2')
    content = content.replace('text-sm text-gray-500 dark:text-slate-400 mb-5', 'text-sm text-gray-500 dark:text-[#888] mb-5')
    content = content.replace('bg-gray-50 dark:bg-slate-900/50', 'bg-gray-50 dark:bg-[#1a1a1a]')
    content = content.replace('text-xs text-gray-400 dark:text-slate-500', 'text-xs text-gray-400 dark:text-[#666]')

    # 5. Fix Start Survey Button inside cards
    content = content.replace('text-[var(--color-cyc-secondary)] dark:text-slate-900', 'text-slate-900')

    with open(file_path, "w") as f:
        f.write(content)
    print("Patched " + file_path)

patch_file("src/app/page.tsx")
