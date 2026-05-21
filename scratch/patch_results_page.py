import re

file_path = "src/app/admin/results/[id]/page.tsx"
with open(file_path, "r") as f:
    content = f.read()

old_resp = """interface Response {
  session_id: string;
  completed_at: string | null;
  answers: Answer[];
}"""
new_resp = """interface Response {
  session_id: string;
  completed_at: string | null;
  answers: Answer[];
  attention_check_failures?: number;
  weight?: number;
  is_valid?: boolean;
}"""
content = content.replace(old_resp, new_resp)

old_get = """  function getAnswersForQuestion(qId: string): Answer[] {
    return responses.flatMap((r: Response) => r.answers.filter((a: Answer) => a.question_id === qId));
  }"""
new_get = """  function getAnswersForQuestion(qId: string): (Answer & { weight: number })[] {
    return responses
      .filter((r: Response) => r.is_valid !== false)
      .flatMap((r: Response) => 
        r.answers
          .filter((a: Answer) => a.question_id === qId)
          .map((a: Answer) => ({ ...a, weight: r.weight ?? 1.0 }))
      );
  }"""
content = content.replace(old_get, new_get)

old_mc = """      answers.forEach(a => {
        if (a.answer_text) {
          if (counts[a.answer_text] === undefined) counts[a.answer_text] = 0;
          counts[a.answer_text]++;
        }
      });
      const modeData = calculateMode(counts);

      return (
        <div>
          <div className="space-y-3">
            {opts.map((opt: string) => {
              const pct = answers.length > 0 ? Math.round((counts[opt] / answers.length) * 100) : 0;"""
new_mc = """      let totalWeighted = 0;
      answers.forEach(a => {
        if (a.answer_text) {
          if (counts[a.answer_text] === undefined) counts[a.answer_text] = 0;
          counts[a.answer_text] += a.weight;
          totalWeighted += a.weight;
        }
      });
      const modeData = calculateMode(counts);

      return (
        <div>
          <div className="space-y-3">
            {opts.map((opt: string) => {
              const pct = totalWeighted > 0 ? Math.round((counts[opt] / totalWeighted) * 100) : 0;"""
content = content.replace(old_mc, new_mc)

old_cb = """      answers.forEach(a => {
        if (a.answer_options) {
          (a.answer_options as string[]).forEach(sel => { if (counts[sel] !== undefined) counts[sel]++; });
        }
      });
      const modeData = calculateMode(counts);

      return (
        <div>
          <div className="space-y-3">
            {opts.map((opt: string) => {
              const pct = answers.length > 0 ? Math.round((counts[opt] / answers.length) * 100) : 0;"""
new_cb = """      let totalWeighted = 0;
      answers.forEach(a => {
        totalWeighted += a.weight;
        if (a.answer_options) {
          (a.answer_options as string[]).forEach(sel => { if (counts[sel] !== undefined) counts[sel] += a.weight; });
        }
      });
      const modeData = calculateMode(counts);

      return (
        <div>
          <div className="space-y-3">
            {opts.map((opt: string) => {
              const pct = totalWeighted > 0 ? Math.round((counts[opt] / totalWeighted) * 100) : 0;"""
content = content.replace(old_cb, new_cb)

old_rating = """    if (q.type === 'rating_scale') {
      const nums = answers.map(a => a.answer_numeric).filter((n): n is number => n !== null);
      const mean = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;"""
new_rating = """    if (q.type === 'rating_scale') {
      const numsAndWeights = answers.filter(a => a.answer_numeric !== null).map(a => ({ n: a.answer_numeric as number, w: a.weight }));
      const nums = numsAndWeights.map(x => x.n);
      const totalW = numsAndWeights.reduce((acc, x) => acc + x.w, 0);
      const mean = totalW > 0 ? numsAndWeights.reduce((a, b) => a + b.n * b.w, 0) / totalW : 0;"""
content = content.replace(old_rating, new_rating)

old_likert = """    if (q.type === 'likert_scale') {
      const nums = answers.map(a => a.answer_numeric).filter((n): n is number => n !== null);
      const mean = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;"""
new_likert = """    if (q.type === 'likert_scale') {
      const numsAndWeights = answers.filter(a => a.answer_numeric !== null).map(a => ({ n: a.answer_numeric as number, w: a.weight }));
      const nums = numsAndWeights.map(x => x.n);
      const totalW = numsAndWeights.reduce((acc, x) => acc + x.w, 0);
      const mean = totalW > 0 ? numsAndWeights.reduce((a, b) => a + b.n * b.w, 0) / totalW : 0;"""
content = content.replace(old_likert, new_likert)

old_indiv_nav = """                  <span className="font-bold text-[var(--color-cyc-secondary)]">Response {currentResponse + 1}</span>
                  <span className="text-gray-400 mx-2">of</span>
                  <span className="font-bold text-[var(--color-cyc-secondary)]">{responses.length}</span>
                  {currentResp?.completed_at && ("""
new_indiv_nav = """                  <span className="font-bold text-[var(--color-cyc-secondary)]">Response {currentResponse + 1}</span>
                  <span className="text-gray-400 mx-2">of</span>
                  <span className="font-bold text-[var(--color-cyc-secondary)]">{responses.length}</span>
                  {currentResp?.attention_check_failures && currentResp.attention_check_failures > 0 ? (
                    <div className="mt-2 inline-flex items-center px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Failed Attention Check ({currentResp.attention_check_failures})
                    </div>
                  ) : null}
                  {currentResp?.completed_at && ("""
content = content.replace(old_indiv_nav, new_indiv_nav)

with open(file_path, "w") as f:
    f.write(content)

print("Patched results page successfully.")
