import re
file_path = "src/app/survey/[id]/page.tsx"
with open(file_path, "r") as f: content = f.read()

# 1. Add useEffect for auto-advance
# We can find useEffect import and add it. We know React is already imported.
# Let's just insert it after the other useEffects, for example after `useEffect(() => { window.scrollTo(0, 0); }, [currentStep]);`
old_scroll_effect = "  useEffect(() => {\n    window.scrollTo(0, 0);\n  }, [currentStep]);"
new_auto_effect = """  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentStep]);

  // Auto-advance for simple section headers
  useEffect(() => {
    if (!isEmailStep && currentQuestion?.type === 'section_header') {
      const opts = getOpts(currentQuestion);
      if (!opts.description && (!opts.attachments || opts.attachments.length === 0)) {
        const timer = setTimeout(() => {
          handleNext();
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [currentStep, currentQuestion]);"""
content = content.replace(old_scroll_effect, new_auto_effect)

# 2. Modify line 550 for vertical centering
old_motion = '            className="flex-1 flex flex-col justify-start max-w-2xl mx-auto w-full pb-4 pt-4 sm:pt-8">'
new_motion = '            className={`flex-1 flex flex-col max-w-2xl mx-auto w-full pb-4 pt-4 sm:pt-8 ${(currentQuestion?.type === \\'section_header\\') ? \\'justify-center my-auto\\' : \\'justify-start\\'}`}>'
content = content.replace(old_motion, new_motion)

# 3. Hide bottom bar if auto-advancing
old_bottom_bar = '<div className="flex-shrink-0 flex justify-between items-center mt-6 pt-4 border-t border-gray-100 bg-white">'
new_bottom_bar = """
        {!(currentQuestion?.type === 'section_header' && !opts.description && (!opts.attachments || opts.attachments.length === 0)) && (
          <div className="flex-shrink-0 flex justify-between items-center mt-6 pt-4 border-t border-gray-100 bg-white">"""
content = content.replace(old_bottom_bar, new_bottom_bar)

# Also need to close the conditional rendering for the bottom bar at the very end
old_closing = "          </motion.button>\n        </div>\n      </div>\n    </div>\n  );\n}"
new_closing = "          </motion.button>\n        </div>\n        )}\n      </div>\n    </div>\n  );\n}"
content = content.replace(old_closing, new_closing)

# Wait, if there are multiple "</div>" at the end, I should be more precise.
# Let's check exactly what the end looks like.

with open(file_path, "w") as f: f.write(content)
print("Patched section_header auto-advance")
