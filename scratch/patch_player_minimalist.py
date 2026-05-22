import re

def patch_file(file_path):
    with open(file_path, "r") as f:
        content = f.read()

    # 1. Main Card styling - Replace .card and accents with elegant glassmorphism
    old_card = 'className="flex-1 flex flex-col card p-4 sm:p-8 shadow-xl border-t-4 border-t-[var(--color-cyc-accent)] relative h-auto min-h-[60vh]"'
    new_card = 'className="flex-1 flex flex-col bg-white dark:bg-white/5 dark:backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl p-4 sm:p-8 shadow-xl relative h-auto min-h-[60vh]"'
    content = content.replace(old_card, new_card)

    # 2. Card Footer styling - Clean seamless transparent background
    old_footer = 'className="flex-shrink-0 flex justify-between items-center mt-auto pt-6 border-t border-gray-100 bg-white dark:bg-slate-800"'
    new_footer = 'className="flex-shrink-0 flex justify-between items-center mt-auto pt-6 border-t border-gray-100 dark:border-white/5 bg-transparent"'
    content = content.replace(old_footer, new_footer)

    # 3. Radio Buttons Option styling
    old_radio = "answers[currentQuestion.id] === opt ? 'border-[var(--color-cyc-primary)] bg-teal-50' : 'border-gray-100 hover:border-teal-200 bg-white dark:bg-slate-800'"
    new_radio = "answers[currentQuestion.id] === opt ? 'border-[var(--color-cyc-primary)] bg-teal-50/50 dark:bg-[var(--color-cyc-primary)]/10 dark:border-[var(--color-cyc-primary)]' : 'border-gray-100 dark:border-white/5 hover:border-teal-200 dark:hover:border-white/15 bg-white dark:bg-white/5'"
    content = content.replace(old_radio, new_radio)

    # 4. Checkbox Option styling
    old_checkbox = "isChecked ? 'border-[var(--color-cyc-primary)] bg-teal-50' : (!isDisabled ? 'border-gray-100 hover:border-teal-200 bg-white dark:bg-slate-800' : '')"
    new_checkbox = "isChecked ? 'border-[var(--color-cyc-primary)] bg-teal-50/50 dark:bg-[var(--color-cyc-primary)]/10 dark:border-[var(--color-cyc-primary)]' : (!isDisabled ? 'border-gray-100 dark:border-white/5 hover:border-teal-200 dark:hover:border-white/15 bg-white dark:bg-white/5' : '')"
    content = content.replace(old_checkbox, new_checkbox)

    # 5. Disabled Option label borders
    old_disabled = "isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-slate-800 border-gray-200' : 'cursor-pointer hover:shadow-md'"
    new_disabled = "isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/5' : 'cursor-pointer hover:shadow-md'"
    content = content.replace(old_disabled, new_disabled)

    # 6. Options "Other" option radio border
    old_other_radio = "answers[currentQuestion.id]?.startsWith('Other: ') ? 'border-[var(--color-cyc-primary)] bg-teal-50' : 'border-gray-100 hover:border-teal-200 bg-white dark:bg-slate-800'"
    new_other_radio = "answers[currentQuestion.id]?.startsWith('Other: ') ? 'border-[var(--color-cyc-primary)] bg-teal-50/50 dark:bg-[var(--color-cyc-primary)]/10 dark:border-[var(--color-cyc-primary)]' : 'border-gray-100 dark:border-white/5 hover:border-teal-200 dark:hover:border-white/15 bg-white dark:bg-white/5'"
    content = content.replace(old_other_radio, new_other_radio)

    # 7. Text colors inside options
    content = content.replace('text-gray-700', 'text-gray-700 dark:text-slate-200')

    # 8. Radio/Checkbox inputs background & border
    content = content.replace('border-gray-300 bg-white dark:bg-slate-800', 'border-gray-300 dark:border-white/10 bg-white dark:bg-white/5')
    content = content.replace('bg-white dark:bg-slate-800 rounded-xl shadow-sm border-t-4 border-t-[var(--color-cyc-primary)] max-w-2xl w-full', 'bg-white dark:bg-white/5 dark:backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200 dark:border-white/10 max-w-2xl w-full')
    content = content.replace('bg-white dark:bg-slate-800 p-8 md:p-12 rounded-2xl shadow-xl border-t-4 border-t-[var(--color-cyc-primary)] max-w-2xl w-full', 'bg-white dark:bg-white/5 dark:backdrop-blur-xl p-8 md:p-12 rounded-2xl shadow-xl border border-gray-200 dark:border-white/10 max-w-2xl w-full')

    # 9. Clean up any dark:bg-slate-800 left in checkboxes/radios manually
    content = content.replace('bg-white dark:bg-slate-800', 'bg-white dark:bg-white/5')

    with open(file_path, "w") as f:
        f.write(content)
    print("Patched " + file_path)

patch_file("src/app/survey/[id]/page.tsx")
