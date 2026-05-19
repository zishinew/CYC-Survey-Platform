"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BarChart3, User, ChevronLeft, ChevronRight } from 'lucide-react';

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

  useEffect(() => {
    fetch(`/api/surveys/${params.id}/results`)
      .then(res => res.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [params.id]);

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
      return (
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
      return (
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
      );
    }

    if (q.type === 'rating_scale') {
      const nums = answers.map(a => a.answer_numeric).filter((n): n is number => n !== null);
      const avg = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '—';
      return (
        <div className="flex items-center space-x-6">
          <div className="text-center">
            <div className="text-4xl font-extrabold text-[var(--color-cyc-primary)]">{avg}%</div>
            <div className="text-sm text-gray-500 mt-1">Average</div>
          </div>
          <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
            <div className="h-full rounded-full bg-[var(--color-cyc-primary)] transition-all duration-500" style={{ width: `${avg}%` }} />
          </div>
        </div>
      );
    }

    if (q.type === 'likert_scale') {
      const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      const labels: Record<number, string> = { 1: 'Strongly Disagree', 2: 'Disagree', 3: 'Neutral', 4: 'Agree', 5: 'Strongly Agree' };
      answers.forEach(a => { if (a.answer_numeric && counts[a.answer_numeric] !== undefined) counts[a.answer_numeric]++; });
      const nums = answers.map(a => a.answer_numeric).filter((n): n is number => n !== null);
      const avg = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '—';
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
        <h1 className="text-3xl font-bold text-[var(--color-cyc-secondary)]">{survey.title}</h1>
        <p className="text-gray-500 mt-1">{total_responses} response{total_responses !== 1 ? 's' : ''}</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-8 max-w-xs">
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
      </div>

      {/* SUMMARY TAB */}
      {tab === 'summary' && (
        <div className="space-y-6">
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
                <button
                  onClick={() => setCurrentResponse(Math.min(responses.length - 1, currentResponse + 1))}
                  disabled={currentResponse === responses.length - 1}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
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
    </div>
  );
}
