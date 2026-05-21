import re

file_path = "src/app/survey/[id]/page.tsx"
with open(file_path, "r") as f:
    content = f.read()

# Replace attn1 definition
old_attn1 = """            const attn1 = {
                id: 'attn-fixed-1',
                type: 'multiple_choice',
                question_text: 'This is an attention check. Please select "Agree" to continue.',
                is_required: true,
                options: { choices: ["Disagree", "Agree", "Neutral"] }
            };"""
new_attn1 = """            const attn1 = {
                id: 'attn-fixed-1',
                type: 'multiple_choice',
                question_text: 'When answering questions about housing and economic policy, it is important to read each statement carefully. To demonstrate that you are paying attention, please select the response option "4 (Agree)" for this specific question. \\n\\nHow strongly do you agree or disagree with the timeline of current federal infrastructure projects?',
                is_required: true,
                options: { choices: ["1 (Strongly disagree)", "2 (Disagree)", "3 (Neutral)", "4 (Agree)", "5 (Strongly agree)"] }
            };"""
content = content.replace(old_attn1, new_attn1)

# Replace attn2 definition
old_attn2 = """            const attn2 = {
                id: 'attn-fixed-2',
                type: 'multiple_choice',
                question_text: 'To make sure you are still reading, please choose "Blue".',
                is_required: true,
                options: { choices: ["Red", "Blue", "Green"] }
            };"""
new_attn2 = """            const attn2 = {
                id: 'attn-fixed-2',
                type: 'multiple_choice',
                question_text: 'To ensure our data quality standards are met for this study, please answer the following straightforward statement: \\n\\n"The government of Canada has officially dissolved the country\\'s currency and banned the exchange of all goods and services."',
                is_required: true,
                options: { choices: ["True", "False"] }
            };"""
content = content.replace(old_attn2, new_attn2)

# Replace evaluation logic
old_eval = """        if (q.id === 'attn-fixed-1' && val === 'Agree') passed = true;
        if (q.id === 'attn-fixed-2' && val === 'Blue') passed = true;"""
new_eval = """        if (q.id === 'attn-fixed-1' && val === '4 (Agree)') passed = true;
        if (q.id === 'attn-fixed-2' && val === 'False') passed = true;"""
content = content.replace(old_eval, new_eval)

with open(file_path, "w") as f:
    f.write(content)

print("Replaced questions successfully.")
