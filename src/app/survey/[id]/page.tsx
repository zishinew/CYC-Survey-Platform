"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle2, FileText, Download } from 'lucide-react';

export default function SurveyPage() {
  const params = useParams();
  const router = useRouter();
  const [survey, setSurvey] = useState<any>(null);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
  const [refNumbers, setRefNumbers] = useState<Record<string, number | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/surveys/${params.id}`)
      .then(res => {
        if (!res.ok) throw new Error("Survey not found");
        return res.json();
      })
      .then(data => {
        const completedSurveys = JSON.parse(localStorage.getItem('cyc_completed_surveys') || '[]');
        if (completedSurveys.includes(data.id)) {
          setAlreadyCompleted(true);
        }
        setSurvey(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching survey", err);
        setError("Survey not found or unavailable.");
        setLoading(false);
      });
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-cyc-primary)]"></div>
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div className="flex-1 flex justify-center items-center text-center p-4">
        <h1 className="text-2xl font-bold text-gray-500">{error}</h1>
      </div>
    );
  }

  if (alreadyCompleted) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center px-4 w-full max-w-3xl mx-auto text-center h-full">
        <div className="bg-white p-8 md:p-12 rounded-2xl shadow-xl border-t-4 border-t-[var(--color-cyc-primary)] max-w-2xl w-full">
          <div className="mx-auto flex justify-center items-center w-20 h-20 bg-teal-50 rounded-full mb-6">
            <CheckCircle2 className="w-12 h-12 text-[var(--color-cyc-primary)]" />
          </div>
          <h1 className="text-3xl font-extrabold text-[var(--color-cyc-secondary)] mb-4">Already Completed</h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            You have already submitted your response for <strong>{survey.title}</strong>. Thank you for participating!
          </p>
        </div>
      </div>
    );
  }

  const handleNext = () => {
    if (currentStep < survey.questions.length - 1) {
      setCurrentStep(curr => curr + 1);
    } else {
      submitSurvey();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(curr => curr - 1);
  };

  const submitSurvey = async () => {
    setSubmitting(true);
    try {
      const formattedAnswers = Object.entries(answers).map(([qId, val]) => {
        const question = survey.questions.find((q: any) => q.id === qId);
        const ans: any = { question_id: qId };
        if (question?.type === 'multiple_choice' || question?.type === 'short_answer') {
          ans.answer_text = val as string;
        } else if (question?.type === 'rating_scale' || question?.type === 'likert_scale') {
          ans.answer_numeric = val as number;
        } else if (question?.type === 'checkboxes') {
          ans.answer_options = val as string[];
        }
        return ans;
      });

      const res = await fetch(`/api/surveys/${survey.id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ survey_id: survey.id, answers: formattedAnswers })
      });

      if (!res.ok) throw new Error("Failed to submit");
      const completedSurveys = JSON.parse(localStorage.getItem('cyc_completed_surveys') || '[]');
      if (!completedSurveys.includes(survey.id)) {
        completedSurveys.push(survey.id);
        localStorage.setItem('cyc_completed_surveys', JSON.stringify(completedSurveys));
      }
      router.push('/thank-you');
    } catch (err) {
      console.error("Submission error", err);
      setSubmitting(false);
      alert("Failed to submit survey. Please try again.");
    }
  };

  const pageVariants = { initial: { opacity: 0, x: 20 }, in: { opacity: 1, x: 0 }, out: { opacity: 0, x: -20 } };
  const pageTransition = { type: "tween", ease: "anticipate", duration: 0.4 } as const;

  // Welcome Screen
  if (!hasStarted) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center px-4 w-full max-w-3xl mx-auto text-center h-full">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} className="w-full">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[var(--color-cyc-secondary)] mb-6 leading-tight">{survey.title}</h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            {survey.description || "Share your voice and help empower Canadian youth."}
          </p>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setHasStarted(true)}
            className="btn-primary text-xl px-10 py-4 rounded-full shadow-xl hover:shadow-2xl transition-all flex items-center justify-center mx-auto">
            Start Survey <ArrowRight className="w-6 h-6 ml-3" />
          </motion.button>
          <p className="text-sm text-gray-400 mt-6 font-medium">Estimated time: {survey.estimated_minutes} minutes</p>
        </motion.div>
      </div>
    );
  }

  // Survey Form
  const currentQuestion = survey.questions[currentStep];
  const progress = ((currentStep + 1) / survey.questions.length) * 100;

  // Helper to get options config
  const getOpts = (q: any) => {
    if (!q.options) return { choices: [], has_other: false, max_selections: undefined, reference_number: undefined, description: '', attachments: [] };
    if (Array.isArray(q.options)) return { choices: q.options, has_other: false, max_selections: undefined, reference_number: undefined, description: '', attachments: [] };
    return {
      choices: q.options.choices || [],
      has_other: q.options.has_other || false,
      max_selections: q.options.max_selections,
      has_calculator: q.options.has_calculator || q.options.reference_number ? true : false,
      description: q.options.description || '',
      attachments: q.options.attachments || [],
    };
  };

  const opts = getOpts(currentQuestion);

  return (
    <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto px-4 py-4 sm:py-6 relative overflow-hidden h-full">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex-shrink-0 mb-6 text-center">
        <div className="w-full bg-gray-200 rounded-full h-2 max-w-2xl mx-auto overflow-hidden">
          <motion.div className="bg-[var(--color-cyc-primary)] h-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
        </div>
        <p className="text-xs sm:text-sm font-bold text-[var(--color-cyc-secondary)] mt-3">
          {currentQuestion.type === 'section_header' ? 'Information' : `Question ${currentStep + 1} of ${survey.questions.length}`}
        </p>
      </motion.div>

      <div className="flex-1 flex flex-col card p-4 sm:p-8 shadow-xl border-t-4 border-t-[var(--color-cyc-accent)] relative overflow-hidden h-full">
        <AnimatePresence mode="wait">
          <motion.div key={currentStep} initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}
            className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full overflow-y-auto no-scrollbar pb-4">
            
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 sm:mb-8 text-[var(--color-cyc-secondary)] text-center leading-snug pt-4">
              {currentQuestion.question_text}
            </h2>
            
            <div className="w-full">
              {/* SECTION HEADER */}
              {currentQuestion.type === 'section_header' && (
                <div className="space-y-4">
                  {opts.description && (
                    <p className="text-base text-gray-600 leading-relaxed whitespace-pre-wrap">{opts.description}</p>
                  )}
                  {opts.attachments.length > 0 && (
                    <div className="space-y-3 mt-4">
                      {opts.attachments.map((att: any, i: number) => (
                        <div key={i}>
                          {att.type?.startsWith('image/') ? (
                            <img src={att.url} alt={att.name} className="rounded-lg border border-gray-200 max-w-full max-h-96 mx-auto" />
                          ) : (
                            <a href={att.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                              <FileText className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0" />
                              <span className="text-sm font-medium text-blue-600 truncate flex-grow">{att.name}</span>
                              <Download className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* MULTIPLE CHOICE */}
              {currentQuestion.type === 'multiple_choice' && (
                <div className="space-y-3 sm:space-y-4">
                  {opts.choices.map((opt: string) => (
                    <label key={opt} className={`flex items-center p-3 sm:p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md ${answers[currentQuestion.id] === opt ? 'border-[var(--color-cyc-primary)] bg-teal-50' : 'border-gray-100 hover:border-teal-200 bg-white'}`}>
                      <input type="radio" name={currentQuestion.id} value={opt} checked={answers[currentQuestion.id] === opt}
                        onChange={(e) => setAnswers({...answers, [currentQuestion.id]: e.target.value})} className="sr-only" />
                      <div className={`w-5 h-5 rounded-full border-2 mr-3 sm:mr-4 flex-shrink-0 flex items-center justify-center ${answers[currentQuestion.id] === opt ? 'border-[var(--color-cyc-primary)]' : 'border-gray-300'}`}>
                        {answers[currentQuestion.id] === opt && <div className="w-2.5 h-2.5 bg-[var(--color-cyc-primary)] rounded-full" />}
                      </div>
                      <span className="text-base sm:text-lg font-medium text-gray-700">{opt}</span>
                    </label>
                  ))}
                  {opts.has_other && (
                    <label className={`flex items-center p-3 sm:p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md ${answers[currentQuestion.id]?.startsWith('Other: ') ? 'border-[var(--color-cyc-primary)] bg-teal-50' : 'border-gray-100 hover:border-teal-200 bg-white'}`}>
                      <input type="radio" name={currentQuestion.id} value="__other__"
                        checked={!!answers[currentQuestion.id]?.startsWith('Other: ')}
                        onChange={() => setAnswers({...answers, [currentQuestion.id]: `Other: ${otherTexts[currentQuestion.id] || ''}`})} className="sr-only" />
                      <div className={`w-5 h-5 rounded-full border-2 mr-3 sm:mr-4 flex-shrink-0 flex items-center justify-center ${!!answers[currentQuestion.id]?.startsWith('Other: ') ? 'border-[var(--color-cyc-primary)]' : 'border-gray-300'}`}>
                        {!!answers[currentQuestion.id]?.startsWith('Other: ') && <div className="w-2.5 h-2.5 bg-[var(--color-cyc-primary)] rounded-full" />}
                      </div>
                      <span className="text-base font-medium text-gray-700 mr-2">Other:</span>
                      <input type="text" value={otherTexts[currentQuestion.id] || ''}
                        onChange={(e) => {
                          setOtherTexts({...otherTexts, [currentQuestion.id]: e.target.value});
                          if (answers[currentQuestion.id]?.startsWith('Other: ')) {
                            setAnswers({...answers, [currentQuestion.id]: `Other: ${e.target.value}`});
                          }
                        }}
                        onFocus={() => setAnswers({...answers, [currentQuestion.id]: `Other: ${otherTexts[currentQuestion.id] || ''}`})}
                        className="flex-grow border-b border-gray-300 focus:border-[var(--color-cyc-primary)] focus:outline-none px-1 py-0.5 bg-transparent"
                        placeholder="Type your answer" />
                    </label>
                  )}
                </div>
              )}

              {/* RATING SCALE with calculator */}
              {currentQuestion.type === 'rating_scale' && (
                <div className="py-8 px-4 sm:px-8 flex flex-col items-center">
                  <div className="text-4xl sm:text-5xl font-extrabold text-[var(--color-cyc-primary)] mb-2">
                    {answers[currentQuestion.id] !== undefined ? answers[currentQuestion.id] : 50}%
                  </div>
                  {opts.has_calculator && refNumbers[currentQuestion.id] !== undefined && (
                    <div className="text-lg font-bold text-[var(--color-cyc-secondary)] mb-2">
                      {Math.round(((answers[currentQuestion.id] !== undefined ? answers[currentQuestion.id] : 50) / 100) * (refNumbers[currentQuestion.id] || 0))} out of {refNumbers[currentQuestion.id]}
                    </div>
                  )}
                  {opts.has_calculator && (
                    <div className="mb-4 flex items-center space-x-2">
                      <label className="text-sm font-medium text-gray-600">Enter a number:</label>
                      <input type="number" min={0}
                        value={refNumbers[currentQuestion.id] ?? ''}
                        onChange={(e) => setRefNumbers({...refNumbers, [currentQuestion.id]: e.target.value ? Number(e.target.value) : undefined})}
                        className="w-28 p-1.5 border-2 border-gray-200 rounded-lg text-center focus:border-[var(--color-cyc-primary)] focus:outline-none font-bold"
                        placeholder="e.g. 100" />
                    </div>
                  )}
                  <input type="range" min="0" max="100"
                    value={answers[currentQuestion.id] !== undefined ? answers[currentQuestion.id] : 50}
                    onChange={(e) => setAnswers({...answers, [currentQuestion.id]: Number(e.target.value)})}
                    className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--color-cyc-primary)]"
                    style={{ background: `linear-gradient(to right, var(--color-cyc-primary) ${answers[currentQuestion.id] !== undefined ? answers[currentQuestion.id] : 50}%, #e5e7eb ${answers[currentQuestion.id] !== undefined ? answers[currentQuestion.id] : 50}%)` }} />
                  <div className="w-full flex justify-between text-sm text-gray-500 mt-4 font-medium">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              )}

              {/* CHECKBOXES with Other */}
              {currentQuestion.type === 'checkboxes' && (
                <div className="space-y-3 sm:space-y-4">
                  {(() => {
                    const maxSelections = opts.max_selections;
                    const currentSelected: string[] = answers[currentQuestion.id] || [];

                    return (
                      <>
                        {maxSelections && <p className="text-sm text-gray-500 font-medium mb-3">Select up to {maxSelections} options</p>}
                        {opts.choices.map((opt: string) => {
                          const isChecked = currentSelected.includes(opt);
                          const isDisabled = !isChecked && maxSelections && currentSelected.length >= maxSelections;
                          return (
                            <label key={opt} className={`flex items-center p-3 sm:p-4 border-2 rounded-xl transition-all duration-200 ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200' : 'cursor-pointer hover:shadow-md'} ${isChecked ? 'border-[var(--color-cyc-primary)] bg-teal-50' : (!isDisabled ? 'border-gray-100 hover:border-teal-200 bg-white' : '')}`}>
                              <input type="checkbox" value={opt} checked={isChecked} disabled={!!isDisabled}
                                onChange={(e) => {
                                  if (isDisabled) return;
                                  if (e.target.checked) setAnswers({...answers, [currentQuestion.id]: [...currentSelected, opt]});
                                  else setAnswers({...answers, [currentQuestion.id]: currentSelected.filter((item: string) => item !== opt)});
                                }} className="sr-only" />
                              <div className={`w-6 h-6 rounded border-2 mr-3 sm:mr-4 flex-shrink-0 flex items-center justify-center transition-colors ${isChecked ? 'bg-[var(--color-cyc-primary)] border-[var(--color-cyc-primary)]' : 'border-gray-300 bg-white'}`}>
                                {isChecked && <CheckCircle2 className="w-4 h-4 text-white" />}
                              </div>
                              <span className="text-base sm:text-lg font-medium text-gray-700">{opt}</span>
                            </label>
                          );
                        })}
                        {opts.has_other && (() => {
                          const otherVal = currentSelected.find((s: string) => s.startsWith('Other: '));
                          const isChecked = !!otherVal;
                          const isDisabled = !isChecked && maxSelections && currentSelected.length >= maxSelections;
                          return (
                            <label className={`flex items-center p-3 sm:p-4 border-2 rounded-xl transition-all duration-200 ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200' : 'cursor-pointer hover:shadow-md'} ${isChecked ? 'border-[var(--color-cyc-primary)] bg-teal-50' : (!isDisabled ? 'border-gray-100 hover:border-teal-200 bg-white' : '')}`}>
                              <input type="checkbox" checked={isChecked} disabled={!!isDisabled}
                                onChange={(e) => {
                                  if (isDisabled) return;
                                  if (e.target.checked) {
                                    setAnswers({...answers, [currentQuestion.id]: [...currentSelected, `Other: ${otherTexts[currentQuestion.id] || ''}`]});
                                  } else {
                                    setAnswers({...answers, [currentQuestion.id]: currentSelected.filter((item: string) => !item.startsWith('Other: '))});
                                  }
                                }} className="sr-only" />
                              <div className={`w-6 h-6 rounded border-2 mr-3 sm:mr-4 flex-shrink-0 flex items-center justify-center transition-colors ${isChecked ? 'bg-[var(--color-cyc-primary)] border-[var(--color-cyc-primary)]' : 'border-gray-300 bg-white'}`}>
                                {isChecked && <CheckCircle2 className="w-4 h-4 text-white" />}
                              </div>
                              <span className="text-base font-medium text-gray-700 mr-2">Other:</span>
                              <input type="text" value={otherTexts[currentQuestion.id] || ''}
                                onChange={(e) => {
                                  setOtherTexts({...otherTexts, [currentQuestion.id]: e.target.value});
                                  if (isChecked) {
                                    setAnswers({...answers, [currentQuestion.id]: [...currentSelected.filter((s: string) => !s.startsWith('Other: ')), `Other: ${e.target.value}`]});
                                  }
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-grow border-b border-gray-300 focus:border-[var(--color-cyc-primary)] focus:outline-none px-1 py-0.5 bg-transparent"
                                placeholder="Type your answer" />
                            </label>
                          );
                        })()}
                      </>
                    );
                  })()}
                </div>
              )}

              {/* LIKERT SCALE */}
              {currentQuestion.type === 'likert_scale' && (
                <div className="flex flex-col items-center w-full px-2 sm:px-6 py-6">
                  <div className="flex justify-between w-full mb-6 text-xs sm:text-sm font-bold text-gray-500">
                    <span className="w-1/3 text-left">Strongly Disagree</span>
                    <span className="w-1/3 text-center">Neutral</span>
                    <span className="w-1/3 text-right">Strongly Agree</span>
                  </div>
                  <div className="flex justify-between items-center w-full relative z-0">
                    <div className="absolute top-1/2 left-4 right-4 h-1.5 bg-gray-200 z-0 -translate-y-1/2 rounded-full"></div>
                    {[1, 2, 3, 4, 5].map((val) => (
                      <label key={val} className="flex flex-col items-center cursor-pointer group relative z-10">
                        <input type="radio" name={currentQuestion.id} value={val} checked={answers[currentQuestion.id] === val}
                          onChange={() => setAnswers({...answers, [currentQuestion.id]: val})} className="sr-only" />
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-4 transition-all duration-300 bg-white shadow-sm ${answers[currentQuestion.id] === val ? 'border-[var(--color-cyc-primary)] scale-125 shadow-md shadow-teal-100 text-[var(--color-cyc-primary)]' : 'border-gray-300 group-hover:border-teal-200 text-gray-500 group-hover:text-teal-500 group-hover:scale-110'}`}>
                          <span className="text-base sm:text-lg font-extrabold">{val}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* SHORT ANSWER */}
              {currentQuestion.type === 'short_answer' && (
                <textarea rows={4}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-[var(--color-cyc-primary)] focus:ring-4 focus:ring-teal-50 focus:outline-none transition-all resize-none text-base sm:text-lg"
                  placeholder="Share your thoughts here..."
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => setAnswers({...answers, [currentQuestion.id]: e.target.value})} />
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex-shrink-0 flex justify-between items-center mt-6 pt-4 border-t border-gray-100 bg-white">
          <button onClick={handleBack} disabled={currentStep === 0}
            className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-medium transition-all ${currentStep === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
            Back
          </button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleNext} disabled={submitting}
            className="btn-primary px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl flex items-center text-base sm:text-lg font-bold shadow-lg shadow-yellow-200 hover:shadow-xl hover:-translate-y-0.5 transition-all">
            {submitting ? 'Submitting...' : (currentStep === survey.questions.length - 1 ? 'Finish Survey' : (currentQuestion.type === 'section_header' ? 'Continue' : 'Next'))}
            {!submitting && currentStep !== survey.questions.length - 1 && <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />}
            {!submitting && currentStep === survey.questions.length - 1 && <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
