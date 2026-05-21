import re
file_path = "src/app/survey/[id]/page.tsx"
with open(file_path, "r") as f: content = f.read()

old_motion = 'className="flex-1 flex flex-col justify-start max-w-2xl mx-auto w-full pb-4 pt-4 sm:pt-8"'
new_motion = 'className={`flex-1 flex flex-col max-w-2xl mx-auto w-full pb-4 pt-4 sm:pt-8 ${currentQuestion?.type === "section_header" ? "justify-center my-auto" : "justify-start"}`}'
content = content.replace(old_motion, new_motion)

old_bottom = '<div className="flex-shrink-0 flex justify-between items-center mt-6 pt-4 border-t border-gray-100 bg-white">'
new_bottom = """{!(currentQuestion?.type === 'section_header' && !opts.description && (!opts.attachments || opts.attachments.length === 0)) && (
          <div className="flex-shrink-0 flex justify-between items-center mt-6 pt-4 border-t border-gray-100 bg-white">"""
content = content.replace(old_bottom, new_bottom)

old_end = """          </motion.button>
        </div>
      </div>
    </div>
  );
}"""
new_end = """          </motion.button>
        </div>
        )}
      </div>
    </div>
  );
}"""
content = content.replace(old_end, new_end)

with open(file_path, "w") as f: f.write(content)
print("UI Patched")
