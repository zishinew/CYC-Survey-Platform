import re
file_path = "src/app/admin/results/[id]/page.tsx"
with open(file_path, "r") as f:
    content = f.read()

old_answer = """interface Answer {
  id: string;
  question_id: string;
  answer_text: string | null;
  answer_numeric: number | null;
  answer_options: string[] | null;
}"""
new_answer = """interface Answer {
  id: string;
  question_id: string;
  answer_text: string | null;
  answer_numeric: number | null;
  answer_options: string[] | null;
  time_spent?: number;
}"""
content = content.replace(old_answer, new_answer)

old_state = "  const [showAdvanced, setShowAdvanced] = useState<Record<string, boolean>>({});"
new_state = "  const [showAdvanced, setShowAdvanced] = useState<Record<string, boolean>>({});\n  const [filterFailed, setFilterFailed] = useState(false);"
content = content.replace(old_state, new_state)

old_display = "  const currentResp = responses[currentResponse];"
new_display = """  const displayResponses = filterFailed ? responses.filter((r: Response) => (r.attention_check_failures || 0) > 0) : responses;
  const currentResp = displayResponses[currentResponse];"""
content = content.replace(old_display, new_display)

old_indiv = """      {/* INDIVIDUAL TAB */}
      {tab === 'individual' && (
        <div>
          {responses.length === 0 ? ("""
new_indiv = """      {/* INDIVIDUAL TAB */}
      {tab === 'individual' && (
        <div>
          <div className="flex justify-end mb-4">
            <label className="flex items-center space-x-2 cursor-pointer bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 transition">
              <input type="checkbox" checked={filterFailed} onChange={(e) => { setFilterFailed(e.target.checked); setCurrentResponse(0); }} className="rounded text-red-500 focus:ring-red-500 w-4 h-4" />
              <span className="text-sm font-semibold text-gray-700">Show Only Failed Attention Checks</span>
            </label>
          </div>
          {displayResponses.length === 0 ? ("""
content = content.replace(old_indiv, new_indiv)

content = content.replace("responses.length - 1", "displayResponses.length - 1")
content = content.replace(">{responses.length}</span>", ">{displayResponses.length}</span>")

old_answer_card = """                      <p className="text-base text-gray-700">{displayValue}</p>
                    </div>"""
new_answer_card = """                      <p className="text-base text-gray-700">
                        {displayValue}
                        {answer?.time_spent !== undefined && (
                          <span className="text-gray-400 text-xs ml-2 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                            {(answer.time_spent / 1000).toFixed(1)}s
                          </span>
                        )}
                      </p>
                    </div>"""
content = content.replace(old_answer_card, new_answer_card)

with open(file_path, "w") as f:
    f.write(content)

print("Results page patched")
