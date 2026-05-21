"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PlusCircle, Trash2, ArrowLeft, Save, Upload, FileText, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';

type QuestionType = 'multiple_choice' | 'short_answer' | 'rating_scale' | 'checkboxes' | 'likert_scale' | 'section_header' | 'dropdown';

interface QuestionDraft {
  id: string;
  question_text: string;
  type: QuestionType;
  options: string[];
  is_required: boolean;
  is_conditional: boolean;
  max_selections?: number;
  has_other?: boolean;
  randomize_options?: boolean;
  reference_number?: number;
  section_description?: string;
  description_alignment?: 'left' | 'center' | 'justify';
  attachments?: { url: string; name: string; type: string }[];
}

export default function CreateSurvey() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(5);
  const [isActive, setIsActive] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const uploadFile = async (file: File): Promise<{ url: string; filename: string } | null> => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      return await res.json();
    } catch {
      alert('File upload failed. Please try again.');
      return null;
    }
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbnailUploading(true);
    const result = await uploadFile(file);
    if (result) setThumbnailUrl(result.url);
    setThumbnailUploading(false);
  };

  const handleAttachmentUpload = async (qId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadFile(file);
    if (result) {
      setQuestions(questions.map(q => {
        if (q.id !== qId) return q;
        return { ...q, attachments: [...(q.attachments || []), { url: result.url, name: result.filename, type: file.type }] };
      }));
    }
  };

  const removeAttachment = (qId: string, index: number) => {
    setQuestions(questions.map(q => {
      if (q.id !== qId) return q;
      const newAttachments = [...(q.attachments || [])];
      newAttachments.splice(index, 1);
      return { ...q, attachments: newAttachments };
    }));
  };

  const addQuestion = (type: QuestionType) => {
    const newQ: QuestionDraft = {
      id: Math.random().toString(36).substr(2, 9),
      question_text: '',
      type,
      options: type === 'multiple_choice' || type === 'checkboxes' || type === 'dropdown' ? ['Option 1'] : [],
      is_required: type === 'section_header' ? false : true,
      is_conditional: false,
      max_selections: type === 'checkboxes' ? 3 : undefined,
      has_other: false,
      randomize_options: false,
      reference_number: type === 'rating_scale' ? undefined : undefined,
      section_description: type === 'section_header' ? '' : undefined,
      description_alignment: type === 'section_header' ? 'left' : undefined,
      attachments: type === 'section_header' ? [] : undefined
    };
    setQuestions([...questions, newQ]);
  };

  const updateQuestion = (id: string, field: keyof QuestionDraft, value: any) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const updateOption = (qId: string, index: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id !== qId) return q;
      const newOptions = [...q.options];
      newOptions[index] = value;
      return { ...q, options: newOptions };
    }));
  };

  const addOption = (qId: string) => {
    setQuestions(questions.map(q => {
      if (q.id !== qId) return q;
      return { ...q, options: [...q.options, `Option ${q.options.length + 1}`] };
    }));
  };

  const removeOption = (qId: string, index: number) => {
    setQuestions(questions.map(q => {
      if (q.id !== qId) return q;
      const newOptions = [...q.options];
      newOptions.splice(index, 1);
      return { ...q, options: newOptions };
    }));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) { setError('Survey title is required'); return; }
    
    if (isActive) {
      const confirmed = window.confirm(
        "WARNING: Publishing this survey as ACTIVE will make it visible to users and PERMANENTLY LOCK it from future edits. Are you sure you want to proceed?"
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
        thumbnail_url: thumbnailUrl || null,
        questions: questions.map((q, idx) => {
          let optionsPayload: any = null;
          if (q.type === 'multiple_choice' || q.type === 'dropdown') {
            optionsPayload = { choices: q.options, has_other: q.has_other || false, randomize_options: q.randomize_options || false };
          } else if (q.type === 'checkboxes') {
            optionsPayload = { choices: q.options, max_selections: q.max_selections, has_other: q.has_other || false, randomize_options: q.randomize_options || false };
          } else if (q.type === 'rating_scale' && q.reference_number) {
            optionsPayload = { has_calculator: true };
          } else if (q.type === 'section_header') {
            optionsPayload = { description: q.section_description || '', attachments: q.attachments || [], description_alignment: q.description_alignment || 'left' };
          }
          return {
            question_text: q.question_text,
            type: q.type,
            order_index: idx + 1,
            is_required: q.is_required,
            is_conditional: q.is_conditional || false,
            options: optionsPayload
          };
        })
      };

      const res = await fetch('/api/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to create survey");
      router.push('/admin');
    } catch (err: any) {
      setError(err.message || 'Error saving survey');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex items-center mb-6">
        <Link href="/admin" className="text-gray-500 hover:text-[var(--color-cyc-secondary)] mr-4">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-3xl font-bold text-[var(--color-cyc-secondary)]">Create New Survey</h1>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded mb-6">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Details */}
        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Survey Title</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none"
              placeholder="e.g. Mental Health Perspectives 2026" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none"
              placeholder="Provide some context for the respondents..." />
          </div>

          {/* Thumbnail Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Survey Thumbnail</label>
            <div className="flex items-center space-x-4">
              {thumbnailUrl ? (
                <div className="relative w-32 h-20 rounded-lg overflow-hidden border border-gray-200">
                  <img src={thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setThumbnailUrl('')}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600">&times;</button>
                </div>
              ) : (
                <label className="flex items-center px-4 py-2 bg-gray-50 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[var(--color-cyc-primary)] transition-colors">
                  <Upload className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="text-sm text-gray-600">{thumbnailUploading ? 'Uploading...' : 'Upload Image'}</span>
                  <input type="file" accept="image/*" onChange={handleThumbnailUpload} className="hidden" disabled={thumbnailUploading} />
                </label>
              )}
            </div>
          </div>

          <div className="flex space-x-6">
            <div className="w-1/3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Est. Time (minutes)</label>
              <input type="number" min={1} value={estimatedMinutes} onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none" />
            </div>
            <div className="w-1/3 flex items-center pt-6">
              <label className="flex items-center cursor-pointer">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
                  className="mr-2 h-5 w-5 text-[var(--color-cyc-primary)]" />
                <span className="font-medium text-gray-700">Set as Active</span>
              </label>
            </div>
          </div>
        </div>

        {/* Questions List */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-[var(--color-cyc-secondary)]">Questions</h2>
          
          {questions.map((q, idx) => (
            <div key={q.id} className={`card relative border-l-4 ${q.type === 'section_header' ? 'border-l-[var(--color-cyc-accent)] bg-yellow-50/30' : 'border-l-[var(--color-cyc-primary)]'}`}>
              <div className="absolute top-4 right-4">
                <button type="button" onClick={() => removeQuestion(q.id)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex items-center space-x-4 mb-4 pr-8">
                <span className="font-bold text-gray-400">{q.type === 'section_header' ? '§' : `Q${idx + 1}`}</span>
                <input type="text" required value={q.question_text}
                  onChange={(e) => updateQuestion(q.id, 'question_text', e.target.value)}
                  className="flex-grow p-2 border rounded font-medium focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none"
                  placeholder={q.type === 'section_header' ? 'Section Title' : 'Enter your question'} />
              </div>

              <div className="flex items-center flex-wrap gap-3 mb-4 text-sm text-gray-600">
                <span className="bg-gray-100 px-2 py-1 rounded capitalize">{q.type.replace('_', ' ')}</span>
                {q.type !== 'section_header' && (
                  <>
                    <label className="flex items-center cursor-pointer">
                      <input type="checkbox" checked={q.is_required}
                        onChange={(e) => updateQuestion(q.id, 'is_required', e.target.checked)}
                        className="mr-2 h-4 w-4 text-[var(--color-cyc-primary)]" />
                      Required
                    </label>
                    <label className="flex items-center cursor-pointer ml-4">
                      <input type="checkbox" checked={q.is_conditional || false}
                        onChange={(e) => updateQuestion(q.id, 'is_conditional', e.target.checked)}
                        className="mr-2 h-4 w-4 text-purple-500" />
                      Skip if answered previously
                    </label>
                  </>
                )}
                {q.type === 'checkboxes' && (
                  <label className="flex items-center">
                    <span className="mr-2">Max Selections:</span>
                    <input type="number" min={1} max={q.options.length + (q.has_other ? 1 : 0)}
                      value={q.max_selections || 1}
                      onChange={(e) => updateQuestion(q.id, 'max_selections', parseInt(e.target.value) || 1)}
                      className="w-16 p-1 border rounded focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none text-center" />
                  </label>
                )}
                {(q.type === 'multiple_choice' || q.type === 'checkboxes' || q.type === 'dropdown') && (
                  <>
                    <label className="flex items-center cursor-pointer">
                      <input type="checkbox" checked={q.has_other || false}
                        onChange={(e) => updateQuestion(q.id, 'has_other', e.target.checked)}
                        className="mr-2 h-4 w-4 text-[var(--color-cyc-primary)]" />
                      Include &quot;Other&quot; option
                    </label>
                    <label className="flex items-center cursor-pointer ml-4">
                      <input type="checkbox" checked={q.randomize_options || false}
                        onChange={(e) => updateQuestion(q.id, 'randomize_options', e.target.checked)}
                        className="mr-2 h-4 w-4 text-[var(--color-cyc-primary)]" />
                      Randomize option order
                    </label>
                  </>
                )}
                {q.type === 'rating_scale' && (
                  <label className="flex items-center cursor-pointer">
                    <input type="checkbox" checked={q.reference_number === 1}
                      onChange={(e) => updateQuestion(q.id, 'reference_number', e.target.checked ? 1 : undefined)}
                      className="mr-2 h-4 w-4 text-[var(--color-cyc-primary)]" />
                    Enable reference number calculator
                  </label>
                )}
              </div>

              {/* Section Header: Description + Attachments */}
              {q.type === 'section_header' && (
                <div className="space-y-3 ml-8">
                  <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-600">Section Description</label>
                    <div className="flex items-center space-x-2">
                      <label className="text-xs text-gray-500">Alignment:</label>
                      <select value={q.description_alignment || 'left'} onChange={(e) => updateQuestion(q.id, 'description_alignment', e.target.value)} className="text-xs border rounded p-1 focus:outline-none">
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="justify">Justify</option>
                      </select>
                    </div>
                  </div>
                    <textarea rows={3} value={q.section_description || ''}
                      onChange={(e) => updateQuestion(q.id, 'section_description', e.target.value)}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none text-sm"
                      placeholder="Provide context or instructions before the next set of questions..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">Attachments</label>
                    {(q.attachments || []).map((att, aIdx) => (
                      <div key={aIdx} className="flex items-center space-x-2 mb-2 bg-white p-2 rounded border text-sm">
                        {att.type.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-green-500" /> : <FileText className="w-4 h-4 text-blue-500" />}
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex-grow truncate">{att.name}</a>
                        <button type="button" onClick={() => removeAttachment(q.id, aIdx)} className="text-red-400 hover:text-red-600">&times;</button>
                      </div>
                    ))}
                    <label className="inline-flex items-center px-3 py-1.5 bg-white border border-dashed border-gray-300 rounded cursor-pointer hover:border-[var(--color-cyc-primary)] transition-colors text-sm">
                      <Upload className="w-3.5 h-3.5 mr-1.5 text-gray-500" />
                      <span className="text-gray-600">Add File (PDF, PNG, JPEG)</span>
                      <input type="file" accept=".pdf,.png,.jpg,.jpeg,image/*,application/pdf" onChange={(e) => handleAttachmentUpload(q.id, e)} className="hidden" />
                    </label>
                  </div>
                </div>
              )}

              {/* Options for MC / Checkboxes */}
              {(q.type === 'multiple_choice' || q.type === 'checkboxes' || q.type === 'dropdown') && (
                <div className="ml-8 space-y-2">
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center space-x-2">
                      <div className={`w-4 h-4 border border-gray-400 ${(q.type === 'multiple_choice' || q.type === 'dropdown') ? 'rounded-full' : 'rounded'}`} />
                      <input type="text" value={opt} required
                        onChange={(e) => updateOption(q.id, oIdx, e.target.value)}
                        className="flex-grow p-1.5 border-b focus:border-[var(--color-cyc-primary)] focus:outline-none bg-transparent" />
                      {q.options.length > 1 && (
                        <button type="button" onClick={() => removeOption(q.id, oIdx)} className="text-gray-400 hover:text-red-500">&times;</button>
                      )}
                    </div>
                  ))}
                  {q.has_other && (
                    <div className="flex items-center space-x-2 opacity-60">
                      <div className={`w-4 h-4 border border-gray-400 ${(q.type === 'multiple_choice' || q.type === 'dropdown') ? 'rounded-full' : 'rounded'}`} />
                      <span className="text-sm text-gray-500 italic">Other: ____</span>
                    </div>
                  )}
                  <button type="button" onClick={() => addOption(q.id)} className="text-sm text-[var(--color-cyc-primary)] hover:underline mt-2 inline-block">
                    + Add Option
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Add Question Controls */}
          <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
            <p className="text-gray-500 mb-4">Add a new question to this survey</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => addQuestion('section_header')} className="px-4 py-2 bg-yellow-50 border border-yellow-300 rounded shadow-sm hover:border-[var(--color-cyc-accent)] transition-colors text-sm font-medium text-yellow-700">
                § Section Header
              </button>
              <button type="button" onClick={() => addQuestion('multiple_choice')} className="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm hover:border-[var(--color-cyc-primary)] transition-colors text-sm font-medium text-gray-700">
                Multiple Choice
              </button>
              <button type="button" onClick={() => addQuestion('checkboxes')} className="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm hover:border-[var(--color-cyc-primary)] transition-colors text-sm font-medium text-gray-700">
                Checkboxes
              </button>
              <button type="button" onClick={() => addQuestion('dropdown')} className="px-4 py-2 bg-white border border-gray-300 rounded shadow-sm hover:border-[var(--color-cyc-primary)] transition-colors text-sm font-medium text-gray-700">
                Dropdown
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
          <Link href="/admin" className="px-6 py-2 text-gray-600 hover:text-gray-900 font-medium mr-4">Cancel</Link>
          <button type="submit" disabled={submitting} className="btn-primary flex items-center">
            {submitting ? 'Saving...' : (<><Save className="w-4 h-4 mr-2" />Save &amp; Publish Survey</>)}
          </button>
        </div>
      </form>
    </div>
  );
}
