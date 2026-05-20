"use client";
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PlusCircle, Trash2, ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

type QuestionType = 'multiple_choice' | 'short_answer' | 'rating_scale' | 'checkboxes' | 'likert_scale';

interface QuestionDraft {
  id: string;
  question_text: string;
  type: QuestionType;
  options: any; // will normalize to array in state
  max_selections?: number;
  has_other?: boolean;
  randomize_options?: boolean;
  is_required: boolean;
}

export default function EditSurvey() {
  const router = useRouter();
  const params = useParams();
  
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(5);
  const [isActive, setIsActive] = useState(false);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/surveys/${params.id}`)
      .then(res => {
        if (!res.ok) throw new Error('Survey not found');
        return res.json();
      })
      .then(data => {
        if (data.is_active) {
          setError("Cannot edit an active survey. Please go back.");
          setLoading(false);
          return;
        }
        setTitle(data.title);
        setDescription(data.description || '');
        setEstimatedMinutes(data.estimated_minutes);
        setIsActive(data.is_active);
        
        // Map questions
        const loadedQuestions = data.questions.map((q: any) => {
          const isArr = !q.options || Array.isArray(q.options);
          return {
            id: Math.random().toString(36).substr(2, 9), // Local IDs for editing
            question_text: q.question_text,
            type: q.type,
            options: isArr ? (q.options || []) : q.options.choices,
            max_selections: !isArr ? q.options.max_selections : (q.type === 'checkboxes' ? 3 : undefined),
            has_other: !isArr ? q.options.has_other : false,
            randomize_options: !isArr ? q.options.randomize_options : false,
            is_required: q.is_required
          };
        });
        setQuestions(loadedQuestions);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [params.id]);

  const getOptionsArray = (options: any) => {
    if (!options) return [];
    if (Array.isArray(options)) return options;
    return options.choices || [];
  };

  const addQuestion = (type: QuestionType) => {
    const newQ: QuestionDraft = {
      id: Math.random().toString(36).substr(2, 9),
      question_text: '',
      type,
      options: type === 'multiple_choice' || type === 'checkboxes' ? ['Option 1'] : [],
      max_selections: type === 'checkboxes' ? 3 : undefined,
      has_other: false,
      randomize_options: false,
      is_required: true
    };
    setQuestions([...questions, newQ]);
  };

  const updateQuestion = (id: string, field: keyof QuestionDraft, value: any) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const updateOption = (qId: string, index: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id !== qId) return q;
      const isArr = Array.isArray(q.options);
      const arr = isArr ? [...q.options] : [...(q.options.choices || [])];
      arr[index] = value;
      return { ...q, options: isArr ? arr : { ...q.options, choices: arr } };
    }));
  };

  const addOption = (qId: string) => {
    setQuestions(questions.map(q => {
      if (q.id !== qId) return q;
      const isArr = Array.isArray(q.options);
      const arr = isArr ? [...q.options] : [...(q.options.choices || [])];
      arr.push(`Option ${arr.length + 1}`);
      return { ...q, options: isArr ? arr : { ...q.options, choices: arr } };
    }));
  };

  const removeOption = (qId: string, index: number) => {
    setQuestions(questions.map(q => {
      if (q.id !== qId) return q;
      const isArr = Array.isArray(q.options);
      const arr = isArr ? [...q.options] : [...(q.options.choices || [])];
      arr.splice(index, 1);
      return { ...q, options: isArr ? arr : { ...q.options, choices: arr } };
    }));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      setError('Survey title is required');
      return;
    }

    if (isActive) {
      const confirmed = window.confirm(
        "WARNING: Publishing this survey as ACTIVE will immediately DEACTIVATE all other currently active surveys, and PERMANENTLY LOCK this survey from future edits. Are you sure you want to proceed?"
      );
      if (!confirmed) return;
    }
    
    setSubmitting(true);
    setError('');

    try {
      const payload = {
        title,
        description,
        estimated_minutes: estimatedMinutes,
        is_active: isActive,
        questions: questions.map((q, idx) => ({
          question_text: q.question_text,
          type: q.type,
          order_index: idx + 1,
          options: q.type === 'multiple_choice' ? { choices: q.options, has_other: q.has_other || false, randomize_options: q.randomize_options || false } : 
                   q.type === 'checkboxes' ? { choices: q.options, max_selections: q.max_selections, has_other: q.has_other || false, randomize_options: q.randomize_options || false } : null,
          is_required: q.is_required
        }))
      };

      const res = await fetch(`/api/surveys/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to update survey");
      }
      
      router.push('/admin');
    } catch (err: any) {
      setError(err.message || 'Error saving survey');
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-cyc-primary)]"></div></div>;
  }

  if (error && error.includes("Cannot edit an active survey")) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <h1 className="text-3xl font-bold text-red-600 mb-6">{error}</h1>
        <Link href="/admin" className="btn-primary">Return to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex items-center mb-6">
        <Link href="/admin" className="text-gray-500 hover:text-[var(--color-cyc-secondary)] mr-4">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-3xl font-bold text-[var(--color-cyc-secondary)]">Edit Survey</h1>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Survey Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none"
            />
          </div>
          <div className="flex space-x-6">
            <div className="w-1/3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Est. Time (minutes)</label>
              <input
                type="number"
                min={1}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none"
              />
            </div>
            <div className="w-1/3 flex items-center pt-6">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="mr-2 h-5 w-5 text-[var(--color-cyc-primary)]"
                />
                <span className="font-medium text-gray-700">Set as Active</span>
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold text-[var(--color-cyc-secondary)]">Questions</h2>
          
          {questions.map((q, idx) => {
            const optionsArray = getOptionsArray(q.options);
            return (
              <div key={q.id} className="card relative border-l-4 border-l-[var(--color-cyc-primary)]">
                <div className="absolute top-4 right-4">
                  <button type="button" onClick={() => removeQuestion(q.id)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="flex items-center space-x-4 mb-4 pr-8">
                  <span className="font-bold text-gray-400">Q{idx + 1}</span>
                  <input
                    type="text"
                    required
                    value={q.question_text}
                    onChange={(e) => updateQuestion(q.id, 'question_text', e.target.value)}
                    className="flex-grow p-2 border rounded font-medium focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none"
                  />
                </div>

                <div className="flex items-center space-x-4 mb-4 text-sm text-gray-600">
                  <span className="bg-gray-100 px-2 py-1 rounded capitalize">{q.type.replace('_', ' ')}</span>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={q.is_required}
                      onChange={(e) => updateQuestion(q.id, 'is_required', e.target.checked)}
                      className="mr-2 h-4 w-4 text-[var(--color-cyc-primary)]"
                    />
                    Required
                  </label>
                  {q.type === 'checkboxes' && (
                    <label className="flex items-center ml-4">
                      <span className="mr-2">Max Selections:</span>
                      <input
                        type="number"
                        min={1}
                        max={optionsArray.length + (q.has_other ? 1 : 0)}
                        value={q.max_selections || 1}
                        onChange={(e) => updateQuestion(q.id, 'max_selections', parseInt(e.target.value) || 1)}
                        className="w-16 p-1 border rounded focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none text-center"
                      />
                    </label>
                  )}
                </div>

                {(q.type === 'multiple_choice' || q.type === 'checkboxes') && (
                  <div className="flex items-center space-x-6 mb-4 text-sm text-gray-600 pl-8">
                    <label className="flex items-center cursor-pointer">
                      <input type="checkbox" checked={q.has_other || false}
                        onChange={(e) => updateQuestion(q.id, 'has_other', e.target.checked)}
                        className="mr-2 h-4 w-4 text-[var(--color-cyc-primary)]" />
                      Include &quot;Other&quot; option
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input type="checkbox" checked={q.randomize_options || false}
                        onChange={(e) => updateQuestion(q.id, 'randomize_options', e.target.checked)}
                        className="mr-2 h-4 w-4 text-[var(--color-cyc-primary)]" />
                      Randomize option order
                    </label>
                  </div>
                )}

                {(q.type === 'multiple_choice' || q.type === 'checkboxes') && (
                  <div className="ml-8 space-y-2">
                    {optionsArray.map((opt: string, oIdx: number) => (
                      <div key={oIdx} className="flex items-center space-x-2">
                        <div className={`w-4 h-4 border border-gray-400 ${q.type === 'multiple_choice' ? 'rounded-full' : 'rounded'}`} />
                        <input
                          type="text"
                          value={opt}
                          required
                          onChange={(e) => updateOption(q.id, oIdx, e.target.value)}
                          className="flex-grow p-1.5 border-b focus:border-[var(--color-cyc-primary)] focus:outline-none bg-transparent"
                        />
                        {optionsArray.length > 1 && (
                          <button type="button" onClick={() => removeOption(q.id, oIdx)} className="text-gray-400 hover:text-red-500">
                            &times;
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={() => addOption(q.id)} className="text-sm text-[var(--color-cyc-primary)] hover:underline mt-2 inline-block">
                      + Add Option
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
            <p className="text-gray-500 mb-4">Add a new question to this survey</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => addQuestion('multiple_choice')} className="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm hover:border-[var(--color-cyc-primary)] transition-colors text-sm font-medium text-gray-700">
                Multiple Choice
              </button>
              <button type="button" onClick={() => addQuestion('checkboxes')} className="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm hover:border-[var(--color-cyc-primary)] transition-colors text-sm font-medium text-gray-700">
                Checkboxes
              </button>
              <button type="button" onClick={() => addQuestion('rating_scale')} className="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm hover:border-[var(--color-cyc-primary)] transition-colors text-sm font-medium text-gray-700">
                Percentage Slider (0-100)
              </button>
              <button type="button" onClick={() => addQuestion('likert_scale')} className="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm hover:border-[var(--color-cyc-primary)] transition-colors text-sm font-medium text-gray-700">
                Likert Scale (1-5)
              </button>
              <button type="button" onClick={() => addQuestion('short_answer')} className="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm hover:border-[var(--color-cyc-primary)] transition-colors text-sm font-medium text-gray-700">
                Short Answer
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t border-gray-200">
          <Link href="/admin" className="px-6 py-2 text-gray-600 hover:text-gray-900 font-medium mr-4">
            Cancel
          </Link>
          <button type="submit" disabled={submitting} className="btn-primary flex items-center">
            {submitting ? 'Saving...' : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Update Survey
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
