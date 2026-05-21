import re

def patch_file(file_path):
    with open(file_path, "r") as f:
        content = f.read()

    # 1. Update interface
    old_interface = "  attachments?: { url: string; name: string; type: string }[];\n}"
    new_interface = "  attachments?: { url: string; name: string; type: string }[];\n  definitions?: {term: string; definition: string}[];\n}"
    if old_interface in content:
        content = content.replace(old_interface, new_interface)
    
    # 2. Add functions
    # For create/page.tsx, add after addOption
    old_add_option = "  const addOption = (qId: string) => {\n    setQuestions(questions.map(q => {\n      if (q.id !== qId) return q;\n      return { ...q, options: [...q.options, `Option ${q.options.length + 1}`] };\n    }));\n  };"
    new_funcs = old_add_option + """

  const addDefinition = (qId: string) => {
    setQuestions(questions.map(q => {
      if (q.id !== qId) return q;
      return { ...q, definitions: [...(q.definitions || []), { term: '', definition: '' }] };
    }));
  };

  const updateDefinition = (qId: string, index: number, field: 'term' | 'definition', value: string) => {
    setQuestions(questions.map(q => {
      if (q.id !== qId) return q;
      const newDefs = [...(q.definitions || [])];
      newDefs[index] = { ...newDefs[index], [field]: value };
      return { ...q, definitions: newDefs };
    }));
  };

  const removeDefinition = (qId: string, index: number) => {
    setQuestions(questions.map(q => {
      if (q.id !== qId) return q;
      const newDefs = [...(q.definitions || [])];
      newDefs.splice(index, 1);
      return { ...q, definitions: newDefs };
    }));
  };"""
    if old_add_option in content:
        content = content.replace(old_add_option, new_funcs)
    
    # For edit/[id]/page.tsx, add after addOption (it might use optIndex instead of index)
    old_add_option_edit = "  const addOption = (qId: string) => {\n    setQuestions(questions.map(q => {\n      if (q.id !== qId) return q;\n      return { ...q, options: [...q.options, `Option ${q.options.length + 1}`] };\n    }));\n  };"
    if old_add_option_edit in content and "addDefinition = " not in content:
        content = content.replace(old_add_option_edit, new_funcs)

    with open(file_path, "w") as f:
        f.write(content)

patch_file("src/app/admin/create/page.tsx")
patch_file("src/app/admin/edit/[id]/page.tsx")
print("Functions patched")
