import re

def patch_file(file_path):
    with open(file_path, "r") as f:
        content = f.read()

    old_text = "                )}\n              </div>\n            );\n          })}"
    
    new_text = """                )}

              {/* Definitions Section */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700">Interactive Definitions</h4>
                  <button type="button" onClick={() => addDefinition(q.id)} className="text-xs text-[var(--color-cyc-primary)] hover:underline">
                    + Add Definition
                  </button>
                </div>
                {q.definitions && q.definitions.length > 0 && (
                  <div className="space-y-2">
                    {q.definitions.map((def, dIdx) => (
                      <div key={dIdx} className="flex items-start space-x-2">
                        <input
                          type="text"
                          value={def.term}
                          onChange={(e) => updateDefinition(q.id, dIdx, 'term', e.target.value)}
                          placeholder="Term to bold"
                          className="w-1/3 p-1.5 border rounded focus:border-[var(--color-cyc-primary)] focus:outline-none text-sm"
                        />
                        <textarea
                          value={def.definition}
                          onChange={(e) => updateDefinition(q.id, dIdx, 'definition', e.target.value)}
                          placeholder="Definition text..."
                          className="flex-grow p-1.5 border rounded focus:border-[var(--color-cyc-primary)] focus:outline-none text-sm resize-none"
                          rows={2}
                        />
                        <button type="button" onClick={() => removeDefinition(q.id, dIdx)} className="text-gray-400 hover:text-red-500 mt-1">
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              </div>
            );
          })}"""
    
    if old_text in content:
        content = content.replace(old_text, new_text)
        with open(file_path, "w") as f:
            f.write(content)
        print(f"Patched {file_path}")
    else:
        print(f"Failed to find hook in {file_path}")

patch_file("src/app/admin/edit/[id]/page.tsx")
