import re

def patch_create():
    file_path = "src/app/admin/create/page.tsx"
    with open(file_path, "r") as f: content = f.read()
    
    content = content.replace("from 'lucide-react';", "Lock, Unlock } from 'lucide-react';")
    content = content.replace("randomize_options?: boolean;", "randomize_options?: boolean;\n  locked_choices?: string[];")
    
    old_add = "randomize_options: false,"
    new_add = "randomize_options: false,\n      locked_choices: [],"
    content = content.replace(old_add, new_add)
    
    new_func = """  const toggleLockChoice = (qId: string, optText: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const locked = q.locked_choices || [];
        const newLocked = locked.includes(optText) ? locked.filter(c => c !== optText) : [...locked, optText];
        return { ...q, locked_choices: newLocked };
      }
      return q;
    }));
  };
"""
    content = content.replace("  const removeOption = (qId: string, optIndex: number) => {", new_func + "  const removeOption = (qId: string, optIndex: number) => {")
    
    old_update_opt = """        const newArr = [...q.options];
        newArr[optIndex] = newValue;
        return { ...q, options: newArr };"""
    new_update_opt = """        const newArr = [...q.options];
        const oldVal = newArr[optIndex];
        newArr[optIndex] = newValue;
        const newLocked = (q.locked_choices || []).map(c => c === oldVal ? newValue : c);
        return { ...q, options: newArr, locked_choices: newLocked };"""
    content = content.replace(old_update_opt, new_update_opt)
    
    old_remove_opt = """        const newArr = q.options.filter((_, i) => i !== optIndex);
        return { ...q, options: newArr };"""
    new_remove_opt = """        const oldVal = q.options[optIndex];
        const newArr = q.options.filter((_, i) => i !== optIndex);
        const newLocked = (q.locked_choices || []).filter(c => c !== oldVal);
        return { ...q, options: newArr, locked_choices: newLocked };"""
    content = content.replace(old_remove_opt, new_remove_opt)

    content = content.replace("optionsPayload = { choices: q.options, has_other: q.has_other || false, randomize_options: q.randomize_options || false };",
                              "optionsPayload = { choices: q.options, has_other: q.has_other || false, randomize_options: q.randomize_options || false, locked_choices: q.locked_choices || [] };")
    content = content.replace("optionsPayload = { choices: q.options, max_selections: q.max_selections, has_other: q.has_other || false, randomize_options: q.randomize_options || false };",
                              "optionsPayload = { choices: q.options, max_selections: q.max_selections, has_other: q.has_other || false, randomize_options: q.randomize_options || false, locked_choices: q.locked_choices || [] };")

    old_ui_input = """                      {q.options.length > 1 && (
                        <button type="button" onClick={() => removeOption(q.id, oIdx)} className="text-gray-400 hover:text-red-500">&times;</button>
                      )}"""
    new_ui_input = """                      <button type="button" onClick={() => toggleLockChoice(q.id, opt)} className={`ml-2 ${(q.locked_choices || []).includes(opt) ? 'text-[var(--color-cyc-primary)]' : 'text-gray-300 hover:text-gray-500'}`} title="Lock Option Position">
                        {(q.locked_choices || []).includes(opt) ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                      {q.options.length > 1 && (
                        <button type="button" onClick={() => removeOption(q.id, oIdx)} className="text-gray-400 hover:text-red-500">&times;</button>
                      )}"""
    content = content.replace(old_ui_input, new_ui_input)
    
    with open(file_path, "w") as f: f.write(content)

def patch_edit():
    file_path = "src/app/admin/edit/[id]/page.tsx"
    with open(file_path, "r") as f: content = f.read()
    
    content = content.replace("from 'lucide-react';", "Lock, Unlock } from 'lucide-react';")
    content = content.replace("randomize_options?: boolean;", "randomize_options?: boolean;\n  locked_choices?: string[];")
    
    content = content.replace("randomize_options: !isArr ? q.options.randomize_options : false,",
                              "randomize_options: !isArr ? q.options.randomize_options : false,\n            locked_choices: !isArr ? q.options.locked_choices || [] : [],")
    
    content = content.replace("randomize_options: false,", "randomize_options: false,\n      locked_choices: [],")
    
    new_func = """  const toggleLockChoice = (qId: string, optText: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const locked = q.locked_choices || [];
        const newLocked = locked.includes(optText) ? locked.filter(c => c !== optText) : [...locked, optText];
        return { ...q, locked_choices: newLocked };
      }
      return q;
    }));
  };
"""
    content = content.replace("  const removeOption = (qId: string, optIndex: number) => {", new_func + "  const removeOption = (qId: string, optIndex: number) => {")
    
    old_update_opt = """        const newArr = [...arr];
        newArr[optIndex] = newValue;
        return { ...q, options: isArr ? newArr : { ...q.options, choices: newArr } };"""
    new_update_opt = """        const oldVal = arr[optIndex];
        const newArr = [...arr];
        newArr[optIndex] = newValue;
        const newLocked = (q.locked_choices || []).map(c => c === oldVal ? newValue : c);
        return { ...q, options: isArr ? newArr : { ...q.options, choices: newArr }, locked_choices: newLocked };"""
    content = content.replace(old_update_opt, new_update_opt)
    
    old_remove_opt = """        const newArr = arr.filter((_, i) => i !== optIndex);
        return { ...q, options: isArr ? newArr : { ...q.options, choices: newArr } };"""
    new_remove_opt = """        const oldVal = arr[optIndex];
        const newArr = arr.filter((_, i) => i !== optIndex);
        const newLocked = (q.locked_choices || []).filter(c => c !== oldVal);
        return { ...q, options: is:Arr ? newArr : { ...q.options, choices: newArr }, locked_choices: newLocked };"""
    content = content.replace(old_remove_opt, new_remove_opt.replace("is:Arr", "isArr"))

    content = content.replace("optionsPayload = { choices: q.options, has_other: q.has_other || false, randomize_options: q.randomize_options || false };",
                              "optionsPayload = { choices: q.options, has_other: q.has_other || false, randomize_options: q.randomize_options || false, locked_choices: q.locked_choices || [] };")
    content = content.replace("optionsPayload = { choices: q.options, max_selections: q.max_selections, has_other: q.has_other || false, randomize_options: q.randomize_options || false };",
                              "optionsPayload = { choices: q.options, max_selections: q.max_selections, has_other: q.has_other || false, randomize_options: q.randomize_options || false, locked_choices: q.locked_choices || [] };")

    old_ui_input = """                        {optionsArray.length > 1 && (
                          <button type="button" onClick={() => removeOption(q.id, oIdx)} className="text-gray-400 hover:text-red-500">
                            &times;
                          </button>
                        )}"""
    new_ui_input = """                        <button type="button" onClick={() => toggleLockChoice(q.id, opt)} className={`ml-2 ${(q.locked_choices || []).includes(opt) ? 'text-[var(--color-cyc-primary)]' : 'text-gray-300 hover:text-gray-500'}`} title="Lock Option Position">
                          {(q.locked_choices || []).includes(opt) ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                        {optionsArray.length > 1 && (
                          <button type="button" onClick={() => removeOption(q.id, oIdx)} className="text-gray-400 hover:text-red-500">
                            &times;
                          </button>
                        )}"""
    content = content.replace(old_ui_input, new_ui_input)
    
    with open(file_path, "w") as f: f.write(content)

def patch_survey():
    file_path = "src/app/survey/[id]/page.tsx"
    with open(file_path, "r") as f: content = f.read()

    content = content.replace("randomize_options: false, description_alignment: 'left' };", "randomize_options: false, locked_choices: [], description_alignment: 'left' };")
    content = content.replace("randomize_options: q.options.randomize_options || false,", "randomize_options: q.options.randomize_options || false,\n      locked_choices: q.options.locked_choices || [],")

    old_display = """    if (opts.randomize_options) {
      return shuffleArray(opts.choices);
    }
    return opts.choices;"""
    new_display = """    if (opts.randomize_options) {
      const locked = opts.locked_choices || [];
      const nonLocked = opts.choices.filter((c: string) => !locked.includes(c));
      const shuffledNonLocked = shuffleArray(nonLocked);
      return opts.choices.map((c: string) => locked.includes(c) ? c : shuffledNonLocked.shift()!);
    }
    return opts.choices;"""
    content = content.replace(old_display, new_display)
    
    with open(file_path, "w") as f: f.write(content)

patch_create()
patch_edit()
patch_survey()
print("All patched!")
