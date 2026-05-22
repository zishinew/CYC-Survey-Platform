with open("src/app/survey/[id]/page.tsx", "r") as f:
    content = f.read()

# Replace starting button styling
content = content.replace(
    'className="btn-primary text-xl px-10 py-4 rounded-full shadow-xl hover:shadow-2xl transition-all flex items-center justify-center mx-auto"',
    'className="btn-primary text-xl px-10 py-4 rounded-full shadow-md shadow-teal-500/5 dark:shadow-teal-400/5 hover:shadow-lg transition-all flex items-center justify-center mx-auto"'
)

# Replace next/continue/finish button styling (strip out shadow-yellow-200)
content = content.replace(
    'className="btn-primary px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl flex items-center text-base sm:text-lg font-bold shadow-lg shadow-yellow-200 hover:shadow-xl hover:-translate-y-0.5 transition-all"',
    'className="btn-primary px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl flex items-center text-base sm:text-lg font-bold shadow-md shadow-teal-500/5 dark:shadow-teal-400/5 hover:shadow-lg hover:-translate-y-0.5 transition-all"'
)

with open("src/app/survey/[id]/page.tsx", "w") as f:
    f.write(content)

print("Patched shadows in survey player page!")
