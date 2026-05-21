"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BarChart3, User, ChevronLeft, ChevronRight, Trash2, ChevronDown, ChevronUp, Calculator, Sparkles, Lightbulb, TrendingUp, Users, AlertTriangle, Target, Zap, RefreshCw } from 'lucide-react';

// --- STATS MATH HELPERS ---
function calculateMedian(arr: number[]) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculateStdDev(arr: number[], mean: number) {
  if (arr.length < 2) return 0;
  const variance = arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function calculateQuartiles(arr: number[]) {
  if (arr.length === 0) return { q1: 0, q3: 0, iqr: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const lowerHalf = sorted.slice(0, mid);
  const upperHalf = sorted.slice(sorted.length % 2 === 0 ? mid : mid + 1);
  const q1 = calculateMedian(lowerHalf);
  const q3 = calculateMedian(upperHalf);
  return { q1, q3, iqr: q3 - q1 };
}

function findOutliers(arr: number[], q1: number, q3: number, iqr: number) {
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  return arr.filter(x => x < lowerBound || x > upperBound);
}

function calculateMode(counts: Record<string | number, number>) {
  let max = 0;
  let modes: string[] = [];
  for (const [key, val] of Object.entries(counts)) {
    if (val > max) { max = val; modes = [key]; }
    else if (val === max && max > 0) { modes.push(key); }
  }
  return modes.length > 0 ? { modes, count: max } : null;
}

interface Answer {
  id: string;
  question_id: string;
  answer_text: string | null;
  answer_numeric: number | null;
  answer_options: string[] | null;
}

interface Response {
  session_id: string;
  completed_at: string | null;
  answers: Answer[];
}

interface Question {
  id: string;
  question_text: string;
  type: string;
  order_index: number;
  options: any;
}

export default function ResultsPage() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'summary' | 'individual'>('summary');
  const [currentResponse, setCurrentResponse] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState<Record<string, boolean>>({});
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const toggleAdvanced = (qId: string) => setShowAdvanced(prev => ({ ...prev, [qId]: !prev[qId] }));

  const fetchResults = () => {
    fetch(`/api/surveys/${params.id}/results`)
      .then(res => res.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchResults(); }, [params.id]);

  const handleDeleteAll = async () => {
    const input = window.prompt(`This will PERMANENTLY DELETE all ${data?.total_responses || 0} responses for this survey. Type "DELETE ALL" to confirm.`);
    if (input !== 'DELETE ALL') { alert('Deletion cancelled.'); return; }
    try {
      await fetch(`/api/surveys/${params.id}/responses`, { method: 'DELETE' });
      setCurrentResponse(0);
      fetchResults();
    } catch { alert('Failed to delete responses.'); }
  };

  const handleDeleteOne = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to delete this individual response? This cannot be undone.')) return;
    try {
      await fetch(`/api/responses/${sessionId}`, { method: 'DELETE' });
      setCurrentResponse(prev => Math.max(0, prev - 1));
      fetchResults();
    } catch { alert('Failed to delete response.'); }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-cyc-primary)]"></div></div>;
  }

  if (!data || !data.questions) {
    return <div className="text-center py-20 text-gray-500">No data found.</div>;
  }

  const { survey, questions, responses, total_responses }: { survey: any, questions: Question[], responses: Response[], total_responses: number } = data;

  // --- SUMMARY HELPERS ---
  function getAnswersForQuestion(qId: string): Answer[] {
    return responses.flatMap((r: Response) => r.answers.filter((a: Answer) => a.question_id === qId));
  }

  const advancedStatsUI = (qId: string, content: React.ReactNode) => (
    <div className="mt-6 pt-4 border-t border-gray-100">
      <button onClick={() => toggleAdvanced(qId)} className="flex items-center text-xs font-semibold text-[var(--color-cyc-primary)] hover:text-teal-700 transition-colors bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-full">
        <Calculator className="w-3 h-3 mr-1.5" />
        {showAdvanced[qId] ? 'Hide Research Stats' : 'Show Research Stats'}
        {showAdvanced[qId] ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
      </button>
      {showAdvanced[qId] && (
        <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {content}
        </div>
      )}
    </div>
  );

  function renderSummaryForQuestion(q: Question) {
    const answers = getAnswersForQuestion(q.id);
    if (answers.length === 0) {
      return <p className="text-sm text-gray-400 italic">No responses yet.</p>;
    }

    if (q.type === 'multiple_choice') {
      const opts: string[] = Array.isArray(q.options) ? q.options : (q.options?.choices || []);
      const counts: Record<string, number> = {};
      opts.forEach((o: string) => counts[o] = 0);
      answers.forEach(a => { if (a.answer_text && counts[a.answer_text] !== undefined) counts[a.answer_text]++; });
      const modeData = calculateMode(counts);

      return (
        <div>
          <div className="space-y-3">
            {opts.map((opt: string) => {
              const pct = answers.length > 0 ? Math.round((counts[opt] / answers.length) * 100) : 0;
              return (
                <div key={opt}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{opt}</span>
                    <span className="text-gray-500">{counts[opt]} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--color-cyc-primary)] transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {answers.length > 0 && advancedStatsUI(q.id, (
            <>
              <div><span className="block text-xs text-gray-500 mb-0.5">Sample Size (N)</span><span className="font-bold">{answers.length}</span></div>
              {modeData && <div className="col-span-2"><span className="block text-xs text-gray-500 mb-0.5">Statistical Mode</span><span className="font-bold">{modeData.modes.join(', ')} ({modeData.count} responses)</span></div>}
            </>
          ))}
        </div>
      );
    }

    if (q.type === 'checkboxes') {
      const opts: string[] = Array.isArray(q.options) ? q.options : (q.options?.choices || []);
      const counts: Record<string, number> = {};
      opts.forEach((o: string) => counts[o] = 0);
      answers.forEach(a => {
        if (a.answer_options) {
          (a.answer_options as string[]).forEach(sel => { if (counts[sel] !== undefined) counts[sel]++; });
        }
      });
      const modeData = calculateMode(counts);

      return (
        <div>
          <div className="space-y-3">
            {opts.map((opt: string) => {
              const pct = answers.length > 0 ? Math.round((counts[opt] / answers.length) * 100) : 0;
              return (
                <div key={opt}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{opt}</span>
                    <span className="text-gray-500">{counts[opt]} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--color-cyc-accent)] transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {answers.length > 0 && advancedStatsUI(q.id, (
            <>
              <div><span className="block text-xs text-gray-500 mb-0.5">Sample Size (N)</span><span className="font-bold">{answers.length}</span></div>
              {modeData && <div className="col-span-2"><span className="block text-xs text-gray-500 mb-0.5">Statistical Mode</span><span className="font-bold">{modeData.modes.join(', ')} ({modeData.count} selections)</span></div>}
            </>
          ))}
        </div>
      );
    }

    if (q.type === 'rating_scale') {
      const nums = answers.map(a => a.answer_numeric).filter((n): n is number => n !== null);
      const mean = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      const avg = nums.length > 0 ? mean.toFixed(1) : '—';
      const median = calculateMedian(nums);
      const stdDev = calculateStdDev(nums, mean);
      const variance = Math.pow(stdDev, 2);
      const min = nums.length > 0 ? Math.min(...nums) : 0;
      const max = nums.length > 0 ? Math.max(...nums) : 0;
      const { q1, q3, iqr } = calculateQuartiles(nums);
      const outliers = findOutliers(nums, q1, q3, iqr);

      return (
        <div>
          <div className="flex items-center space-x-6">
            <div className="text-center">
              <div className="text-4xl font-extrabold text-[var(--color-cyc-primary)]">{avg}%</div>
              <div className="text-sm text-gray-500 mt-1">Average</div>
            </div>
            <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
              <div className="h-full rounded-full bg-[var(--color-cyc-primary)] transition-all duration-500" style={{ width: `${avg}%` }} />
            </div>
          </div>
          {nums.length > 0 && advancedStatsUI(q.id, (
            <>
              <div><span className="block text-xs text-gray-500 mb-0.5">Sample Size (N)</span><span className="font-bold">{nums.length}</span></div>
              <div><span className="block text-xs text-gray-500 mb-0.5">Median</span><span className="font-bold">{median}</span></div>
              <div><span className="block text-xs text-gray-500 mb-0.5">Standard Deviation</span><span className="font-bold">{stdDev.toFixed(2)}</span></div>
              <div><span className="block text-xs text-gray-500 mb-0.5">Variance</span><span className="font-bold">{variance.toFixed(2)}</span></div>
              <div><span className="block text-xs text-gray-500 mb-0.5">Range (Min - Max)</span><span className="font-bold">{min} - {max}</span></div>
              <div><span className="block text-xs text-gray-500 mb-0.5">Quartiles (Q1, Q3)</span><span className="font-bold">{q1}, {q3}</span></div>
              <div><span className="block text-xs text-gray-500 mb-0.5">IQR</span><span className="font-bold">{iqr}</span></div>
              <div className="col-span-2">
                <span className="block text-xs text-gray-500 mb-0.5">Outliers (1.5*IQR)</span>
                {outliers.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {outliers.map((o, i) => <span key={i} className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md text-xs font-bold">{o}</span>)}
                  </div>
                ) : <span className="font-bold text-gray-400">None detected</span>}
              </div>
            </>
          ))}
        </div>
      );
    }

    if (q.type === 'likert_scale') {
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      const labels: Record<number, string> = { 1: 'Strongly Disagree', 2: 'Disagree', 3: 'Neutral', 4: 'Agree', 5: 'Strongly Agree' };
      answers.forEach(a => { if (a.answer_numeric && counts[a.answer_numeric] !== undefined) counts[a.answer_numeric]++; });
      const nums = answers.map(a => a.answer_numeric).filter((n): n is number => n !== null);
      const mean = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      const avg = nums.length > 0 ? mean.toFixed(1) : '—';
      const median = Math.round(calculateMedian(nums));
      const stdDev = calculateStdDev(nums, mean);
      const modeData = calculateMode(counts);

      return (
        <div>
          <div className="text-center mb-4">
            <span className="text-3xl font-extrabold text-[var(--color-cyc-primary)]">{avg}</span>
            <span className="text-sm text-gray-500 ml-2">/ 5 average</span>
          </div>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map(val => {
              const pct = answers.length > 0 ? Math.round((counts[val] / answers.length) * 100) : 0;
              return (
                <div key={val} className="flex items-center space-x-3">
                  <span className="w-32 text-xs text-right text-gray-600 font-medium">{labels[val]}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--color-cyc-primary)] transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-16">{counts[val]} ({pct}%)</span>
                </div>
              );
            })}
          </div>
          {nums.length > 0 && advancedStatsUI(q.id, (
            <>
              <div><span className="block text-xs text-gray-500 mb-0.5">Sample Size (N)</span><span className="font-bold">{nums.length}</span></div>
              <div className="col-span-2"><span className="block text-xs text-gray-500 mb-0.5">Median</span><span className="font-bold">{median} ({labels[median] || ''})</span></div>
              <div><span className="block text-xs text-gray-500 mb-0.5">Standard Deviation</span><span className="font-bold">{stdDev.toFixed(2)}</span></div>
              {modeData && <div className="col-span-2"><span className="block text-xs text-gray-500 mb-0.5">Statistical Mode</span><span className="font-bold">{modeData.modes.map(m => labels[Number(m)] || m).join(', ')}</span></div>}
            </>
          ))}
        </div>
      );
    }

    if (q.type === 'short_answer') {
      return (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {answers.map((a, i) => (
            <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700">
              {a.answer_text || <span className="text-gray-400 italic">No response</span>}
            </div>
          ))}
        </div>
      );
    }

    return null;
  }

  // --- INDIVIDUAL VIEW ---
  const currentResp = responses[currentResponse];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <Link href="/admin" className="text-gray-500 hover:text-gray-700 flex items-center text-sm mb-4">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-cyc-secondary)]">{survey.title}</h1>
            <p className="text-gray-500 mt-1">{total_responses} response{total_responses !== 1 ? 's' : ''}</p>
          </div>
          {total_responses > 0 && (
            <button
              onClick={handleDeleteAll}
              className="flex items-center px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-semibold transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Results
            </button>
          )}
        </div>
      </div>

      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-8 max-w-md">
        <button
          onClick={() => setTab('summary')}
          className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-semibold transition-all ${tab === 'summary' ? 'bg-white shadow text-[var(--color-cyc-secondary)]' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <BarChart3 className="w-4 h-4 mr-2" /> Summary
        </button>
        <button
          onClick={() => setTab('individual')}
          className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-semibold transition-all ${tab === 'individual' ? 'bg-white shadow text-[var(--color-cyc-secondary)]' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <User className="w-4 h-4 mr-2" /> Individual
        </button>
        <button
          onClick={() => {
            setTab('ai' as any);
            if (!aiAnalysis && !aiLoading) {
              setAiLoading(true);
              setAiError('');
              fetch(`/api/surveys/${params.id}/ai-analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force_refresh: false })
              })
                .then(res => { if (!res.ok) return res.json().then(d => { throw new Error(d.detail || 'Analysis failed'); }); return res.json(); })
                .then(d => { setAiAnalysis(d); setAiLoading(false); })
                .catch(e => { setAiError(e.message); setAiLoading(false); });
            }
          }}
          className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-semibold transition-all ${(tab as string) === 'ai' ? 'bg-gradient-to-r from-purple-500 to-indigo-500 shadow text-white' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Sparkles className="w-4 h-4 mr-2" /> AI Insights
        </button>
      </div>

      {/* SUMMARY TAB */}
      {tab === 'summary' && (
        <div className="space-y-6">
          {/* Referral Breakdown */}
          {data.referral_breakdown && Object.keys(data.referral_breakdown).length > 0 && (
            <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
              <h3 className="text-base font-bold text-[var(--color-cyc-secondary)] mb-1 flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-9.86a4.5 4.5 0 016.364 6.364l-4.5 4.5a4.5 4.5 0 01-7.244-1.242" /></svg>
                Referral Sources
              </h3>
              <p className="text-xs text-gray-400 mb-4">Where your responses came from</p>
              <div className="space-y-3">
                {Object.entries(data.referral_breakdown as Record<string, number>)
                  .sort(([, a], [, b]) => b - a)
                  .map(([source, count]) => {
                    const pct = total_responses > 0 ? Math.round((count / total_responses) * 100) : 0;
                    return (
                      <div key={source}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700 capitalize">{source}</span>
                          <span className="text-gray-500">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                          <div className="bg-gradient-to-r from-indigo-400 to-purple-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {questions.map((q: Question, idx: number) => (
            <div key={q.id} className="bg-white rounded-xl shadow border border-gray-200 p-6">
              <h3 className="text-base font-bold text-[var(--color-cyc-secondary)] mb-1">
                {idx + 1}. {q.question_text}
              </h3>
              <p className="text-xs text-gray-400 mb-4 capitalize">{q.type.replace('_', ' ')}</p>
              {renderSummaryForQuestion(q)}
            </div>
          ))}
        </div>
      )}

      {/* INDIVIDUAL TAB */}
      {tab === 'individual' && (
        <div>
          {responses.length === 0 ? (
            <p className="text-center text-gray-500 py-12">No responses yet.</p>
          ) : (
            <>
              {/* Navigation */}
              <div className="flex items-center justify-between bg-white rounded-xl shadow border border-gray-200 p-4 mb-6">
                <button
                  onClick={() => setCurrentResponse(Math.max(0, currentResponse - 1))}
                  disabled={currentResponse === 0}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <span className="font-bold text-[var(--color-cyc-secondary)]">Response {currentResponse + 1}</span>
                  <span className="text-gray-400 mx-2">of</span>
                  <span className="font-bold text-[var(--color-cyc-secondary)]">{responses.length}</span>
                  {currentResp?.completed_at && (
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(currentResp.completed_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleDeleteOne(currentResp.session_id)}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete this response"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentResponse(Math.min(responses.length - 1, currentResponse + 1))}
                    disabled={currentResponse === responses.length - 1}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Answer Cards */}
              <div className="space-y-4">
                {questions.map((q: Question, idx: number) => {
                  const answer = currentResp?.answers.find((a: Answer) => a.question_id === q.id);
                  let displayValue: string = '—';

                  if (answer) {
                    if (q.type === 'multiple_choice') {
                      displayValue = answer.answer_text || '—';
                    } else if (q.type === 'short_answer') {
                      displayValue = answer.answer_text || '—';
                    } else if (q.type === 'rating_scale') {
                      displayValue = answer.answer_numeric !== null ? `${answer.answer_numeric}%` : '—';
                    } else if (q.type === 'likert_scale') {
                      const labels: Record<number, string> = { 1: 'Strongly Disagree', 2: 'Disagree', 3: 'Neutral', 4: 'Agree', 5: 'Strongly Agree' };
                      displayValue = answer.answer_numeric !== null ? `${answer.answer_numeric} — ${labels[answer.answer_numeric] || ''}` : '—';
                    } else if (q.type === 'checkboxes') {
                      displayValue = answer.answer_options ? (answer.answer_options as string[]).join(', ') : '—';
                    }
                  }

                  return (
                    <div key={q.id} className="bg-white rounded-xl shadow border border-gray-200 p-5">
                      <h4 className="text-sm font-bold text-[var(--color-cyc-secondary)] mb-1">
                        {idx + 1}. {q.question_text}
                      </h4>
                      <p className="text-base text-gray-700">{displayValue}</p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* AI INSIGHTS TAB */}
      {(tab as string) === 'ai' && (
        <div className="space-y-6">
          {aiLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-purple-200 border-t-purple-500 animate-spin" />
                <Sparkles className="w-6 h-6 text-purple-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="mt-6 text-lg font-semibold text-[var(--color-cyc-secondary)]">Analyzing responses with AI...</p>
              <p className="text-sm text-gray-400 mt-1">This may take 15-30 seconds</p>
            </div>
          )}

          {aiError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
              <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
              <p className="text-red-700 font-semibold mb-1">Analysis Failed</p>
              <p className="text-red-500 text-sm mb-4">{aiError}</p>
              <button onClick={() => {
                setAiLoading(true); setAiError('');
                fetch(`/api/surveys/${params.id}/ai-analysis`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force_refresh: true }) })
                  .then(res => { if (!res.ok) return res.json().then(d => { throw new Error(d.detail || 'Analysis failed'); }); return res.json(); })
                  .then(d => { setAiAnalysis(d); setAiLoading(false); })
                  .catch(e => { setAiError(e.message); setAiLoading(false); });
              }} className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-semibold hover:bg-red-200 transition-colors">
                <RefreshCw className="w-4 h-4 inline mr-2" />Retry
              </button>
            </div>
          )}

          {aiAnalysis && !aiLoading && (
            <>
              {/* Overall Score + Summary */}
              <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 rounded-2xl p-6 sm:p-8 text-white shadow-xl">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  {/* Score Ring */}
                  <div className="relative w-32 h-32 flex-shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke="white" strokeWidth="8" strokeDasharray={`${(aiAnalysis.persuadability_score?.overall || 0) * 2.64} 264`} strokeLinecap="round" className="transition-all duration-1000" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-extrabold">{aiAnalysis.persuadability_score?.overall || 0}</span>
                      <span className="text-xs opacity-75">{aiAnalysis.persuadability_score?.label || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="text-center sm:text-left">
                    <h2 className="text-2xl font-extrabold mb-2 flex items-center justify-center sm:justify-start">
                      <Sparkles className="w-6 h-6 mr-2" /> Persuadability Score
                    </h2>
                    <p className="text-white/80 leading-relaxed text-sm sm:text-base">{aiAnalysis.overall_summary}</p>
                    <p className="text-xs text-white/50 mt-3">Based on {aiAnalysis.meta?.total_respondents || 0} respondents · Generated {aiAnalysis.meta?.generated_at ? new Date(aiAnalysis.meta.generated_at).toLocaleString() : 'just now'}</p>
                  </div>
                </div>
              </div>

              {/* Key Findings */}
              {aiAnalysis.key_findings?.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-[var(--color-cyc-secondary)] mb-4 flex items-center"><Lightbulb className="w-5 h-5 mr-2 text-yellow-500" />Key Findings</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {aiAnalysis.key_findings.map((f: any, i: number) => {
                      const iconMap: Record<string, any> = { lightbulb: Lightbulb, trending_up: TrendingUp, users: Users, alert_triangle: AlertTriangle, bar_chart: BarChart3 };
                      const Icon = iconMap[f.icon] || Lightbulb;
                      const confColor = f.confidence === 'High' ? 'bg-green-100 text-green-700' : f.confidence === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600';
                      return (
                        <div key={i} className="bg-white rounded-xl shadow border border-gray-200 p-5 hover:shadow-md transition-shadow">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                              <Icon className="w-5 h-5 text-purple-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="text-sm font-bold text-[var(--color-cyc-secondary)] truncate">{f.title}</h4>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${confColor}`}>{f.confidence}</span>
                              </div>
                              <p className="text-sm text-gray-600 leading-relaxed">{f.description}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Demographic Segments */}
              {aiAnalysis.demographic_segments?.length > 0 && (
                <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-[var(--color-cyc-secondary)] mb-4 flex items-center"><Users className="w-5 h-5 mr-2 text-indigo-500" />Demographic Segments</h3>
                  <div className="space-y-4">
                    {aiAnalysis.demographic_segments.map((seg: any, i: number) => {
                      const barColor = seg.persuadability >= 70 ? 'from-green-400 to-emerald-500' : seg.persuadability >= 40 ? 'from-yellow-400 to-orange-400' : 'from-red-400 to-rose-500';
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-800">{seg.segment_name}</span>
                              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{seg.size} respondent{seg.size !== 1 ? 's' : ''}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-gray-500">{seg.label}</span>
                              <span className="text-sm font-bold text-[var(--color-cyc-secondary)]">{seg.persuadability}</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`} style={{ width: `${seg.persuadability}%` }} />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{seg.key_trait}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Opinion Flexibility */}
              {aiAnalysis.opinion_flexibility_map?.length > 0 && (
                <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-[var(--color-cyc-secondary)] mb-4 flex items-center"><TrendingUp className="w-5 h-5 mr-2 text-teal-500" />Opinion Flexibility Map</h3>
                  <div className="space-y-3">
                    {aiAnalysis.opinion_flexibility_map.map((item: any, i: number) => {
                      const sentimentColor: Record<string, string> = { 'Strongly For': 'text-green-600 bg-green-50', 'For': 'text-green-500 bg-green-50', 'Mixed': 'text-yellow-600 bg-yellow-50', 'Against': 'text-red-500 bg-red-50', 'Strongly Against': 'text-red-600 bg-red-50' };
                      return (
                        <div key={i} className="border border-gray-100 rounded-lg p-4 hover:border-gray-200 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-gray-800 flex-1 mr-4">{item.topic}</span>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${sentimentColor[item.sentiment] || 'text-gray-600 bg-gray-50'}`}>{item.sentiment}</span>
                              <span className="text-sm font-bold text-purple-600">{item.flexibility_score}</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden mb-2">
                            <div className="h-full rounded-full bg-gradient-to-r from-purple-400 to-indigo-500 transition-all duration-700" style={{ width: `${item.flexibility_score}%` }} />
                          </div>
                          <p className="text-xs text-gray-500">{item.insight}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {aiAnalysis.recommendations?.length > 0 && (
                <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
                  <h3 className="text-lg font-bold text-[var(--color-cyc-secondary)] mb-4 flex items-center"><Target className="w-5 h-5 mr-2 text-orange-500" />Recommendations</h3>
                  <div className="space-y-4">
                    {aiAnalysis.recommendations.map((rec: any, i: number) => (
                      <div key={i} className="flex gap-4 p-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-xl">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Zap className="w-4 h-4 text-orange-600" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-800 mb-1">{rec.action}</h4>
                          <p className="text-xs text-gray-500 mb-1"><span className="font-semibold text-gray-600">Target:</span> {rec.target_audience}</p>
                          <p className="text-xs text-gray-500"><span className="font-semibold text-gray-600">Rationale:</span> {rec.rationale}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Regenerate Button */}
              <div className="text-center pt-2">
                <button onClick={() => {
                  setAiLoading(true); setAiError(''); setAiAnalysis(null);
                  fetch(`/api/surveys/${params.id}/ai-analysis`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force_refresh: true }) })
                    .then(res => { if (!res.ok) return res.json().then(d => { throw new Error(d.detail || 'Analysis failed'); }); return res.json(); })
                    .then(d => { setAiAnalysis(d); setAiLoading(false); })
                    .catch(e => { setAiError(e.message); setAiLoading(false); });
                }} className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
                  <RefreshCw className="w-4 h-4 mr-2" /> Regenerate Analysis
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
