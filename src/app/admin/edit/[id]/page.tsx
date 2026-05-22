"use client";
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PlusCircle, Trash2, ArrowLeft, Save, Upload, FileText, Image as ImageIcon , Lock, Unlock } from 'lucide-react';
import Link from 'next/link';
import { RichTextEditor } from '@/components/RichTextEditor';

type QuestionType = 'multiple_choice' | 'short_answer' | 'rating_scale' | 'checkboxes' | 'likert_scale' | 'dropdown' | 'section_header';

interface QuestionDraft {
  id: string;
  question_text: string;
  type: QuestionType;
  options: any; // will normalize to array in state
  max_selections?: number;
  has_other?: boolean;
  randomize_options?: boolean;
  locked_choices?: string[];
  is_required: boolean;
  is_conditional: boolean;
  section_description?: string;
  description_alignment?: 'left' | 'center' | 'justify';
  attachments?: { url: string; name: string; type: string }[];
  reference_number?: number;
  definitions?: {term: string; definition: string}[];
}

export default function EditSurvey() {
  const router = useRouter();
  const params = useParams();
  
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionAlignment, setDescriptionAlignment] = useState('left');
  const [estimatedMinutes, setEstimatedMinutes] = useState(5);
  const [isActive, setIsActive] = useState(false);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [translationUploading, setTranslationUploading] = useState(false);
  const [translationSuccess, setTranslationSuccess] = useState('');
  
  // Translation Editor Modal State
  const [showTranslationModal, setShowTranslationModal] = useState(false);
  const [translationJSON, setTranslationJSON] = useState('');
  const [translationSaving, setTranslationSaving] = useState(false);
  const [translationModalError, setTranslationModalError] = useState('');

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
        setDescriptionAlignment(data.description_alignment || 'left');
        setEstimatedMinutes(data.estimated_minutes);
        setIsActive(data.is_active);
        setThumbnailUrl(data.thumbnail_url || '');
        
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
            locked_choices: !isArr ? q.options.locked_choices || [] : [],
            is_required: q.is_required,
            is_conditional: q.is_conditional || false,
            section_description: !isArr ? q.options.description : undefined,
            description_alignment: (!isArr && q.options.description_alignment) ? q.options.description_alignment : undefined,
            attachments: !isArr ? q.options.attachments : undefined,
            reference_number: (!isArr && q.options.has_calculator) ? 1 : undefined,
            definitions: !isArr ? q.options.definitions : undefined
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
      options: type === 'multiple_choice' || type === 'checkboxes' || type === 'dropdown' ? ['Option 1'] : [],
      max_selections: type === 'checkboxes' ? 3 : undefined,
      has_other: false,
      randomize_options: false,
      locked_choices: [],
      is_required: type === 'section_header' ? false : true,
      is_conditional: false,
      section_description: type === 'section_header' ? '' : undefined,
      description_alignment: type === 'section_header' ? 'left' : undefined,
      attachments: type === 'section_header' ? [] : undefined,
      reference_number: type === 'rating_scale' ? undefined : undefined
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

  const handleTranslationUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setTranslationUploading(true);
    setTranslationSuccess('');
    setError('');
    
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`/api/surveys/${params.id}/translate-pdf`, { method: 'POST', body: formData });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Translation parsing failed');
      }
      setTranslationSuccess('Successfully translated and saved French survey schema!');
    } catch (err: any) {
      setError(err.message || 'Translation failed');
    } finally {
      setTranslationUploading(false);
    }
  };

  const openTranslationEditor = async () => {
    try {
      setTranslationModalError('');
      setTranslationJSON('Loading...');
      setShowTranslationModal(true);
      const res = await fetch(`/api/surveys/${params.id}/translation`);
      if (!res.ok) throw new Error('Failed to fetch translation');
      const data = await res.json();
      if (data.questions_fr) {
        setTranslationJSON(JSON.stringify(data.questions_fr, null, 2));
      } else {
        setTranslationJSON('[\n  // No translation found yet\n]');
      }
    } catch (err: any) {
      setTranslationModalError(err.message);
      setTranslationJSON('[]');
    }
  };

  const saveTranslation = async () => {
    setTranslationSaving(true);
    setTranslationModalError('');
    try {
      const parsed = JSON.parse(translationJSON);
      if (!Array.isArray(parsed)) throw new Error('JSON must be an array of questions');
      
      const res = await fetch(`/api/surveys/${params.id}/translation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions_fr: parsed })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to save translation');
      }
      setShowTranslationModal(false);
      setTranslationSuccess('Manually updated French translation successfully!');
    } catch (err: any) {
      setTranslationModalError(err.message || 'Invalid JSON syntax');
    } finally {
      setTranslationSaving(false);
    }
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

  const addOption = (qId: string) => {
    setQuestions(questions.map(q => {
      if (q.id !== qId) return q;
      const isArr = Array.isArray(q.options);
      const arr = isArr ? [...q.options] : [...(q.options.choices || [])];
      arr.push(`Option ${arr.length + 1}`);
      return { ...q, options: isArr ? arr : { ...q.options, choices: arr } };
    }));
  };

  const addDefinition = (qId: string) => {
    setQuestions(questions.map(q => {
      if (q.id !== qId) return q;
      return { ...q, definitions: [...(q.definitions || []), { term: '', definition: '' }] };
    }));
  };

  const updateDefinition = (qId: string, index: number, field: 'term' | 'definition', value: string) => {
    setQuestions(questions.map(q => {
      if (q.id !== qId) return q;
      const newDefs = [...(q.definitions || [])];
      newDefs[index] = { ...newDefs[index], [field]: value };
      return { ...q, definitions: newDefs };
    }));
  };

  const removeDefinition = (qId: string, index: number) => {
    setQuestions(questions.map(q => {
      if (q.id !== qId) return q;
      const newDefs = [...(q.definitions || [])];
      newDefs.splice(index, 1);
      return { ...q, definitions: newDefs };
    }));
  };

  const toggleLockChoice = (qId: string, optText: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId) {
        const locked = q.locked_choices || [];
        const newLocked = locked.includes(optText) ? locked.filter(c => c !== optText) : [...locked, optText];
        return { ...q, locked_choices: newLocked };
      }
      return q;
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

  const moveQuestionUp = (index: number) => {
    if (index === 0) return;
    const newQs = [...questions];
    [newQs[index - 1], newQs[index]] = [newQs[index], newQs[index - 1]];
    setQuestions(newQs);
  };

  const moveQuestionDown = (index: number) => {
    if (index === questions.length - 1) return;
    const newQs = [...questions];
    [newQs[index + 1], newQs[index]] = [newQs[index], newQs[index + 1]];
    setQuestions(newQs);
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
        description_alignment: descriptionAlignment,
        thumbnail_url: thumbnailUrl || undefined,
        estimated_minutes: estimatedMinutes,
        is_active: isActive,
        questions: questions.map((q, idx) => {
          let optionsPayload: any = null;
          if (q.type === 'multiple_choice' || q.type === 'dropdown') {
            optionsPayload = { choices: q.options, has_other: q.has_other || false, randomize_options: q.randomize_options || false, locked_choices: q.locked_choices || [] };
          } else if (q.type === 'checkboxes') {
            optionsPayload = { choices: q.options, max_selections: q.max_selections, has_other: q.has_other || false, randomize_options: q.randomize_options || false, locked_choices: q.locked_choices || [] };
          } else if (q.type === 'rating_scale' && q.reference_number) {
            optionsPayload = { has_calculator: true };
          } else if (q.type === 'section_header') {
            optionsPayload = { description: q.section_description || '', attachments: q.attachments || [], description_alignment: q.description_alignment || 'left' };
          }
          if (q.definitions && q.definitions.length > 0) {
            if (!optionsPayload) optionsPayload = {};
            optionsPayload.definitions = q.definitions;
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
        <Link href="/admin" className="text-gray-500 dark:text-slate-500 hover:text-[var(--color-cyc-secondary)] dark:text-slate-100 mr-4">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-3xl font-bold text-[var(--color-cyc-secondary)] dark:text-slate-100">Edit Survey</h1>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Survey Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Description (Optional)</label>
              <div className="flex items-center space-x-2">
                <label className="text-xs text-gray-500 dark:text-slate-500">Alignment:</label>
                <select value={descriptionAlignment} onChange={(e) => setDescriptionAlignment(e.target.value)} className="text-xs border rounded p-1 focus:outline-none">
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="justify">Justify</option>
                </select>
              </div>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:border-transparent transition-all"
              rows={4}
              placeholder="What is this survey about?"
            />
          </div>
          {/* Thumbnail Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Survey Thumbnail</label>
            <div className="flex items-center space-x-4">
              {thumbnailUrl ? (
                <div className="relative w-32 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700">
                  <img src={thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setThumbnailUrl('')}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600">&times;</button>
                </div>
              ) : (
                <label className="flex items-center px-4 py-2 bg-gray-50 dark:bg-slate-900/50 border border-dashed border-gray-300 dark:border-slate-600 rounded-lg cursor-pointer hover:border-[var(--color-cyc-primary)] transition-colors">
                  <Upload className="w-4 h-4 mr-2 text-gray-500 dark:text-slate-500" />
                  <span className="text-sm text-gray-600 dark:text-slate-400">{thumbnailUploading ? 'Uploading...' : 'Upload Image'}</span>
                  <input type="file" accept="image/*" onChange={handleThumbnailUpload} className="hidden" disabled={thumbnailUploading} />
                </label>
              )}
            </div>
          </div>
          {/* Translation Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">French Translation (PDF)</label>
            <div className="flex items-center space-x-4">
              <label className={`flex items-center px-4 py-2 border border-dashed rounded-lg cursor-pointer transition-colors ${translationSuccess ? 'bg-green-50 border-green-300 hover:border-green-400' : 'bg-gray-50 dark:bg-slate-900/50 border-gray-300 dark:border-slate-600 hover:border-[var(--color-cyc-primary)]'}`}>
                <FileText className={`w-4 h-4 mr-2 ${translationSuccess ? 'text-green-500' : 'text-gray-500 dark:text-slate-500'}`} />
                <span className={`text-sm ${translationSuccess ? 'text-green-600' : 'text-gray-600 dark:text-slate-400'}`}>
                  {translationUploading ? 'Translating via AI...' : translationSuccess ? 'Translation Active' : 'Upload French PDF'}
                </span>
                <input type="file" accept="application/pdf" onChange={handleTranslationUpload} className="hidden" disabled={translationUploading} />
              </label>
              <button 
                type="button" 
                onClick={openTranslationEditor}
                className="text-sm font-medium text-[var(--color-cyc-primary)] hover:underline ml-4"
              >
                View/Edit Translation
              </button>
              {translationSuccess && <span className="text-xs text-green-600 font-medium">{translationSuccess}</span>}
            </div>
          </div>
          <div className="flex space-x-6">
            <div className="w-1/3">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Est. Time (minutes)</label>
              <input
                type="number"
                min={1}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none"
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
                <span className="font-medium text-gray-700 dark:text-slate-300">Set as Active</span>
              </label>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold text-[var(--color-cyc-secondary)] dark:text-slate-100">Questions</h2>
          
          {questions.map((q, qIdx) => {
            const optionsArray = getOptionsArray(q.options);
            return (
              <div key={q.id} className={`card p-6 border-l-4 shadow-sm relative group ${q.type === 'section_header' ? 'border-l-[var(--color-cyc-accent)] bg-yellow-50/30' : 'border-l-[var(--color-cyc-primary)]'}`}>
                <div className="absolute top-4 right-4 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" onClick={() => moveQuestionUp(qIdx)} disabled={qIdx === 0} className={`p-1.5 rounded ${qIdx === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 dark:text-slate-500 hover:text-[var(--color-cyc-primary)] hover:bg-teal-50'}`} title="Move Up">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                  </button>
                  <button type="button" onClick={() => moveQuestionDown(qIdx)} disabled={qIdx === questions.length - 1} className={`p-1.5 rounded ${qIdx === questions.length - 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 dark:text-slate-500 hover:text-[var(--color-cyc-primary)] hover:bg-teal-50'}`} title="Move Down">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  <button type="button" onClick={() => removeQuestion(q.id)} className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 rounded" title="Delete Question">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex items-center space-x-3 mb-4">
                  <span className="font-bold text-gray-400 dark:text-slate-500">{q.type === 'section_header' ? '§' : `Q${qIdx + 1}`}</span>
                  <input
                    type="text"
                    required
                    value={q.question_text}
                    onChange={(e) => updateQuestion(q.id, 'question_text', e.target.value)}
                    className="flex-grow p-2 border rounded font-medium focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none"
                  />
                </div>

                <div className="flex items-center space-x-4 mb-4 text-sm text-gray-600 dark:text-slate-400">
                  
                  <div className="flex items-center gap-4">
                  <label className="flex items-center cursor-pointer text-sm text-gray-600 dark:text-slate-400">
                    <input type="checkbox"
                      checked={q.is_required}
                      onChange={(e) => updateQuestion(q.id, 'is_required', e.target.checked)}
                      className="mr-2 h-4 w-4 text-[var(--color-cyc-primary)]" />
                    Required
                  </label>
                  <label className="flex items-center cursor-pointer text-sm text-gray-600 dark:text-slate-400">
                    <input type="checkbox" checked={q.is_conditional || false}
                      onChange={(e) => updateQuestion(q.id, 'is_conditional', e.target.checked)}
                      className="mr-2 h-4 w-4 text-purple-500" />
                    Skip if answered previously
                  </label>
                </div>
                  {q.type === 'checkboxes' && (
                    <label className="flex items-center ml-4">
                      <span className="mr-2">Max Selections:</span>
                      <input
                        type="number"
                        min={1}
                        max={optionsArray.length + (q.has_other ? 1 : 0)}
                        value={q.max_selections || 1}
                        onChange={(e) => updateQuestion(q.id, 'max_selections', parseInt(e.target.value) || 1)}
                        className="w-16 p-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none text-center"
                      />
                    </label>
                  )}
                </div>

                {(q.type === 'multiple_choice' || q.type === 'checkboxes' || q.type === 'dropdown') && (
                  <div className="flex items-center space-x-6 mb-4 text-sm text-gray-600 dark:text-slate-400 pl-8">
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

                {q.type === 'rating_scale' && (
                  <div className="flex items-center space-x-6 mb-4 text-sm text-gray-600 dark:text-slate-400 pl-8">
                    <label className="flex items-center cursor-pointer">
                      <input type="checkbox" checked={q.reference_number === 1}
                        onChange={(e) => updateQuestion(q.id, 'reference_number', e.target.checked ? 1 : undefined)}
                        className="mr-2 h-4 w-4 text-[var(--color-cyc-primary)]" />
                      Enable reference number calculator
                    </label>
                  </div>
                )}

                {(q.type === 'multiple_choice' || q.type === 'checkboxes' || q.type === 'dropdown') && (
                  <div className="ml-10 pr-28 space-y-2">
                    {optionsArray.map((opt: string, oIdx: number) => (
                      <div key={oIdx} className="flex items-center space-x-2">
                        <div className={`w-4 h-4 border border-gray-400 ${(q.type === 'multiple_choice' || q.type === 'dropdown') ? 'rounded-full' : 'rounded'}`} />
                        <input
                          type="text"
                          value={opt}
                          required
                          onChange={(e) => updateOption(q.id, oIdx, e.target.value)}
                          className="flex-grow p-1.5 border-b focus:border-[var(--color-cyc-primary)] focus:outline-none bg-transparent"
                        />
                        <button type="button" onClick={() => toggleLockChoice(q.id, opt)} className={`ml-2 ${(q.locked_choices || []).includes(opt) ? 'text-[var(--color-cyc-primary)]' : 'text-gray-300 hover:text-gray-500 dark:text-slate-500'}`} title="Lock Option Position">
                          {(q.locked_choices || []).includes(opt) ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                        {optionsArray.length > 1 && (
                          <button type="button" onClick={() => removeOption(q.id, oIdx)} className="text-gray-400 dark:text-slate-500 hover:text-red-500">
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

                {/* Section Header: Description + Attachments */}
                {q.type === 'section_header' && (
                  <div className="space-y-3 ml-10 pr-28">
                    <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-gray-600 dark:text-slate-400">Section Description</label>
                    <div className="flex items-center space-x-2">
                      <label className="text-xs text-gray-500 dark:text-slate-500">Alignment:</label>
                      <select value={q.description_alignment || 'left'} onChange={(e) => updateQuestion(q.id, 'description_alignment', e.target.value)} className="text-xs border rounded p-1 focus:outline-none">
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="justify">Justify</option>
                      </select>
                    </div>
                  </div>
                      <RichTextEditor
                        value={q.section_description || ''}
                        onChange={(val) => updateQuestion(q.id, 'section_description', val)}
                        placeholder="Provide context or instructions before the next set of questions..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 dark:text-slate-400 mb-1">Attachments</label>
                      {(q.attachments || []).map((att, aIdx) => (
                        <div key={aIdx} className="flex items-center space-x-2 mb-2 bg-white dark:bg-slate-800 p-2 rounded border text-sm">
                          {att.type.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-green-500" /> : <FileText className="w-4 h-4 text-blue-500" />}
                          <a href={att.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex-grow truncate">{att.name}</a>
                          <button type="button" onClick={() => removeAttachment(q.id, aIdx)} className="text-red-400 hover:text-red-600">&times;</button>
                        </div>
                      ))}
                      <label className="inline-flex items-center px-3 py-1.5 bg-white dark:bg-slate-800 border border-dashed border-gray-300 dark:border-slate-600 rounded cursor-pointer hover:border-[var(--color-cyc-primary)] transition-colors text-sm">
                        <Upload className="w-3.5 h-3.5 mr-1.5 text-gray-500 dark:text-slate-500" />
                        <span className="text-gray-600 dark:text-slate-400">Add File (PDF, PNG, JPEG)</span>
                        <input type="file" accept=".pdf,.png,.jpg,.jpeg,image/*,application/pdf" onChange={(e) => handleAttachmentUpload(q.id, e)} className="hidden" />
                      </label>
                    </div>
                  </div>
                )}

              {/* Definitions Section */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Interactive Definitions</h4>
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
                        <button type="button" onClick={() => removeDefinition(q.id, dIdx)} className="text-gray-400 dark:text-slate-500 hover:text-red-500 mt-1">
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              </div>
            );
          })}

          <div className="bg-gray-50 dark:bg-slate-900/50 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-6 text-center">
            <p className="text-gray-500 dark:text-slate-500 mb-4">Add a new question to this survey</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => addQuestion('section_header')} className="px-4 py-2 bg-yellow-50 border border-yellow-300 rounded shadow-sm hover:border-[var(--color-cyc-accent)] transition-colors text-sm font-medium text-yellow-700">
                § Section Header
              </button>
              <button type="button" onClick={() => addQuestion('multiple_choice')} className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded shadow-sm hover:border-[var(--color-cyc-primary)] transition-colors text-sm font-medium text-gray-700 dark:text-slate-300">
                Multiple Choice
              </button>
              <button type="button" onClick={() => addQuestion('checkboxes')} className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded shadow-sm hover:border-[var(--color-cyc-primary)] transition-colors text-sm font-medium text-gray-700 dark:text-slate-300">
                Checkboxes
              </button>
              <button type="button" onClick={() => addQuestion('dropdown')} className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded shadow-sm hover:border-[var(--color-cyc-primary)] transition-colors text-sm font-medium text-gray-700 dark:text-slate-300">
                Dropdown
              </button>
              <button type="button" onClick={() => addQuestion('rating_scale')} className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded shadow-sm hover:border-[var(--color-cyc-primary)] transition-colors text-sm font-medium text-gray-700 dark:text-slate-300">
                Percentage Slider (0-100)
              </button>
              <button type="button" onClick={() => addQuestion('likert_scale')} className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded shadow-sm hover:border-[var(--color-cyc-primary)] transition-colors text-sm font-medium text-gray-700 dark:text-slate-300">
                Likert Scale (1-5)
              </button>
              <button type="button" onClick={() => addQuestion('short_answer')} className="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded shadow-sm hover:border-[var(--color-cyc-primary)] transition-colors text-sm font-medium text-gray-700 dark:text-slate-300">
                Short Answer
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t border-gray-200 dark:border-slate-700">
          <Link href="/admin" className="px-6 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:text-slate-100 font-medium mr-4">
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

      {showTranslationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-4xl flex flex-col h-[80vh]">
            <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Edit French Translation (JSON)</h3>
              <button onClick={() => setShowTranslationModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                &times;
              </button>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col p-4 relative">
              <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                This is the raw JSON generated by the AI for the French translation. You can manually tweak wording here. Ensure the JSON syntax remains valid!
              </p>
              {translationModalError && (
                <div className="p-3 mb-2 bg-red-50 text-red-700 rounded text-sm border border-red-200">
                  {translationModalError}
                </div>
              )}
              <textarea
                value={translationJSON}
                onChange={(e) => setTranslationJSON(e.target.value)}
                className="w-full flex-1 p-4 font-mono text-sm border border-gray-300 dark:border-slate-700 rounded focus:outline-none focus:ring-2 focus:ring-[var(--color-cyc-primary)] bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-gray-100 whitespace-pre"
                spellCheck={false}
              />
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-slate-800 flex justify-end space-x-3 bg-gray-50 dark:bg-slate-900/50 rounded-b-xl">
              <button
                type="button"
                onClick={() => setShowTranslationModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveTranslation}
                disabled={translationSaving}
                className="btn-primary"
              >
                {translationSaving ? 'Saving...' : 'Save Translation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
