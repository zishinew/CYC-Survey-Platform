"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BarChart3, User, ChevronLeft, ChevronRight, Trash2, ChevronDown, ChevronUp, Calculator, Sparkles, Lightbulb, TrendingUp, Users, AlertTriangle, Target, Zap, RefreshCw, Brain, Eye, Search, Layers } from 'lucide-react';
import AiInsightsTab from '@/components/AiInsightsTab';

interface Answer {
  id: string;
  question_id: string;
  answer_text: string | null;
  answer_numeric: number | null;
  answer_options: string[] | null;
  time_spent?: number;
}

interface Response {
  session_id: string;
  completed_at: string | null;
  answers: Answer[];
  attention_check_failures?: number;
  weight?: number;
  is_valid?: boolean;
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
  const [filterFailed, setFilterFailed] = useState(false);

  const toggleAdvanced = (qId: string) => setShowAdvanced(prev => ({ ...prev, [qId]: !prev[qId] }));

  const fetchResults = () => {
    setLoading(true);
    const queryParams = new URLSearchParams();
    queryParams.append('mode', tab);
    if (tab === 'individual') {
      queryParams.append('page', (currentResponse + 1).toString());
      queryParams.append('limit', '1');
      queryParams.append('filter_failed', filterFailed.toString());
    }
    fetch(`/api/surveys/${params.id}/results?${queryParams.toString()}`)
      .then(res => res.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchResults();
  }, [params.id, tab, currentResponse, filterFailed]);

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

  const { survey, questions, responses = [], total_responses, summary_stats = {} }: { survey: any, questions: Question[], responses?: Response[], total_responses: number, summary_stats?: any } = data;

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
    const stats = summary_stats[q.id];
    if (!stats || !stats.counts) {
      return <p className="text-sm text-gray-400 italic">No summary available.</p>;
    }

    if (q.type === 'multiple_choice' || q.type === 'dropdown') {
      const opts: string[] = Array.isArray(q.options) ? q.options : (q.options?.choices || []);
      const counts = stats.counts;
      const sampleSize = stats.sample_size || 0;
      const modeData = stats.modeData;

      return (
        <div>
          <div className="space-y-3">
            {opts.map((opt: string) => {
              const pct = sampleSize > 0 ? Math.round(((counts[opt] || 0) / sampleSize) * 100) : 0;
              return (
                <div key={opt}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{opt}</span>
                    <span className="text-gray-500">{counts[opt] || 0} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--color-cyc-primary)] transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {sampleSize > 0 && advancedStatsUI(q.id, (
            <>
              <div><span className="block text-xs text-gray-500 mb-0.5">Sample Size (N)</span><span className="font-bold">{sampleSize}</span></div>
              {modeData && <div className="col-span-2"><span className="block text-xs text-gray-500 mb-0.5">Statistical Mode</span><span className="font-bold">{modeData.modes.join(', ')} ({modeData.count} responses)</span></div>}
            </>
          ))}
        </div>
      );
    }

    if (q.type === 'checkboxes') {
      const opts: string[] = Array.isArray(q.options) ? q.options : (q.options?.choices || []);
      const counts = stats.counts;
      const sampleSize = stats.sample_size || 0;
      const totalWeighted = stats.total_weighted || 0;
      const modeData = stats.modeData;

      return (
        <div>
          <div className="space-y-3">
            {opts.map((opt: string) => {
              const pct = totalWeighted > 0 ? Math.round(((counts[opt] || 0) / totalWeighted) * 100) : 0;
              return (
                <div key={opt}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{opt}</span>
                    <span className="text-gray-500">{counts[opt] || 0} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--color-cyc-accent)] transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {sampleSize > 0 && advancedStatsUI(q.id, (
            <>
              <div><span className="block text-xs text-gray-500 mb-0.5">Sample Size (N)</span><span className="font-bold">{sampleSize}</span></div>
              {modeData && <div className="col-span-2"><span className="block text-xs text-gray-500 mb-0.5">Statistical Mode</span><span className="font-bold">{modeData.modes.join(', ')} ({modeData.count} selections)</span></div>}
            </>
          ))}
        </div>
      );
    }

    if (q.type === 'rating_scale') {
      const { sample_size: numsLength, mean, median, std_dev: stdDev, variance, min, max, quartiles, outliers } = stats;
      const { q1, q3, iqr } = quartiles || { q1: 0, q3: 0, iqr: 0 };
      const avg = numsLength > 0 ? mean.toFixed(1) : '—';

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
          {numsLength > 0 && advancedStatsUI(q.id, (
            <>
              <div><span className="block text-xs text-gray-500 mb-0.5">Sample Size (N)</span><span className="font-bold">{numsLength}</span></div>
              <div><span className="block text-xs text-gray-500 mb-0.5">Median</span><span className="font-bold">{median}</span></div>
              <div><span className="block text-xs text-gray-500 mb-0.5">Standard Deviation</span><span className="font-bold">{stdDev?.toFixed(2) || 0}</span></div>
              <div><span className="block text-xs text-gray-500 mb-0.5">Variance</span><span className="font-bold">{variance?.toFixed(2) || 0}</span></div>
              <div><span className="block text-xs text-gray-500 mb-0.5">Range (Min - Max)</span><span className="font-bold">{min} - {max}</span></div>
              <div><span className="block text-xs text-gray-500 mb-0.5">Quartiles (Q1, Q3)</span><span className="font-bold">{q1}, {q3}</span></div>
              <div><span className="block text-xs text-gray-500 mb-0.5">IQR</span><span className="font-bold">{iqr}</span></div>
              <div className="col-span-2">
                <span className="block text-xs text-gray-500 mb-0.5">Outliers (1.5*IQR)</span>
                {outliers && outliers.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {outliers.map((o: number, i: number) => <span key={i} className="px-2 py-0.5 bg-red-100 text-red-700 rounded-md text-xs font-bold">{o}</span>)}
                  </div>
                ) : <span className="font-bold text-gray-400">None detected</span>}
              </div>
            </>
          ))}
        </div>
      );
    }

    if (q.type === 'likert_scale') {
      const { counts, sample_size: numsLength, mean, median, std_dev: stdDev, modeData } = stats;
      const labels: Record<number, string> = { 1: 'Strongly Disagree', 2: 'Disagree', 3: 'Neutral', 4: 'Agree', 5: 'Strongly Agree' };
      const avg = numsLength > 0 ? mean.toFixed(1) : '—';
      const roundedMedian = Math.round(median || 0);

      return (
        <div>
          <div className="text-center mb-4">
            <span className="text-3xl font-extrabold text-[var(--color-cyc-primary)]">{avg}</span>
            <span className="text-sm text-gray-500 ml-2">/ 5 average</span>
          </div>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map(val => {
              const pct = numsLength > 0 ? Math.round(((counts[val] || 0) / numsLength) * 100) : 0;
              return (
                <div key={val} className="flex items-center space-x-3">
                  <span className="w-32 text-xs text-right text-gray-600 font-medium">{labels[val]}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--color-cyc-primary)] transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-16">{counts[val] || 0} ({pct}%)</span>
                </div>
              );
            })}
          </div>
          {numsLength > 0 && advancedStatsUI(q.id, (
            <>
              <div><span className="block text-xs text-gray-500 mb-0.5">Sample Size (N)</span><span className="font-bold">{numsLength}</span></div>
              <div className="col-span-2"><span className="block text-xs text-gray-500 mb-0.5">Median</span><span className="font-bold">{roundedMedian} ({labels[roundedMedian] || ''})</span></div>
              <div><span className="block text-xs text-gray-500 mb-0.5">Standard Deviation</span><span className="font-bold">{stdDev?.toFixed(2) || 0}</span></div>
              {modeData && <div className="col-span-2"><span className="block text-xs text-gray-500 mb-0.5">Statistical Mode</span><span className="font-bold">{modeData.modes.map((m: string) => labels[Number(m)] || m).join(', ')}</span></div>}
            </>
          ))}
        </div>
      );
    }

    if (q.type === 'short_answer' || q.type === 'long_text') {
      return <p className="text-sm text-gray-400 italic">Open-ended questions are no longer supported in summary view.</p>;
    }

    return null;
  }


  // --- INDIVIDUAL VIEW ---
  const currentResp = tab === 'individual' ? responses[0] : null;
  const totalIndividualCount = total_responses;

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
          onClick={() => setTab('ai' as any)}
          className={`flex-1 flex items-center justify-center px-4 py-2 rounded-md text-sm font-semibold transition-all ${(tab as string) === 'ai' ? 'bg-white shadow text-[var(--color-cyc-secondary)]' : 'text-gray-500 hover:text-gray-700'}`}
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
                          <div className="bg-[var(--color-cyc-primary)] h-2.5 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
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
          <div className="flex justify-end mb-4">
            <label className="flex items-center space-x-2 cursor-pointer bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 transition">
              <input type="checkbox" checked={filterFailed} onChange={(e) => { setFilterFailed(e.target.checked); setCurrentResponse(0); }} className="rounded text-red-500 focus:ring-red-500 w-4 h-4" />
              <span className="text-sm font-semibold text-gray-700">Show Only Failed Attention Checks</span>
            </label>
          </div>
          {totalIndividualCount === 0 ? (
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
                  <span className="font-bold text-[var(--color-cyc-secondary)]">{totalIndividualCount}</span>
                  {currentResp?.attention_check_failures && currentResp.attention_check_failures > 0 ? (
                    <div className="mt-2 inline-flex items-center px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Failed Attention Check ({currentResp.attention_check_failures})
                    </div>
                  ) : null}
                  {currentResp?.completed_at && (
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(currentResp.completed_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {currentResp?.session_id && (
                    <button
                      onClick={() => handleDeleteOne(currentResp.session_id)}
                      className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete this response"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setCurrentResponse(Math.min(totalIndividualCount - 1, currentResponse + 1))}
                    disabled={currentResponse === totalIndividualCount - 1}
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
                    if (q.type === 'multiple_choice' || q.type === 'dropdown') {
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
                      <p className="text-base text-gray-700">
                        {displayValue}
                        {answer?.time_spent !== undefined && (
                          <span className="text-gray-400 text-xs ml-2 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                            {(answer.time_spent / 1000).toFixed(1)}s
                          </span>
                        )}
                      </p>
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
        <AiInsightsTab surveyId={params.id as string} totalRespondents={total_responses} />
      )}
    </div>
  );
}
