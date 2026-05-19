"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [survey, setSurvey] = useState<any>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/surveys')
      .then(res => res.json())
      .then(list => {
        if (list.length > 0) {
          return fetch(`/api/surveys/${list[0].id}`);
        }
        throw new Error("No active surveys available");
      })
      .then(res => res.json())
      .then(data => {
        setSurvey(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching survey", err);
        setError("Currently, there are no active surveys.");
        setLoading(false);
      });
  }, []);

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

  const handleNext = () => {
    if (currentStep < survey.questions.length - 1) {
      setCurrentStep(curr => curr + 1);
    } else {
      submitSurvey();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(curr => curr - 1);
    }
  };

  const submitSurvey = async () => {
    setSubmitting(true);
    try {
      const formattedAnswers = Object.entries(answers).map(([qId, val]) => {
        const question = survey.questions.find((q: any) => q.id === qId);
        const ans: any = { question_id: qId };
        
        if (question?.type === 'multiple_choice' || question?.type === 'short_answer') {
          ans.answer_text = val as string;
        } else if (question?.type === 'rating_scale') {
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
      router.push('/thank-you');
    } catch (err) {
      console.error("Submission error", err);
      setSubmitting(false);
      alert("Failed to submit survey. Please try again.");
    }
  };

  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: -20 }
  };
  
  const pageTransition = {
    type: "tween",
    ease: "anticipate",
    duration: 0.4
  };

  // Welcome Screen State
  if (!hasStarted) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center px-4 w-full max-w-3xl mx-auto text-center h-full">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full"
        >
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[var(--color-cyc-secondary)] mb-6 leading-tight">
            {survey.title}
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            {survey.description || "Share your voice and help empower Canadian youth."}
          </p>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setHasStarted(true)}
            className="btn-primary text-xl px-10 py-4 rounded-full shadow-xl hover:shadow-2xl transition-all flex items-center justify-center mx-auto"
          >
            Start Survey
            <ArrowRight className="w-6 h-6 ml-3" />
          </motion.button>
          <p className="text-sm text-gray-400 mt-6 font-medium">
            Estimated time: {survey.estimated_minutes} minutes
          </p>
        </motion.div>
      </div>
    );
  }

  // Survey Form State
  const currentQuestion = survey.questions[currentStep];
  const progress = ((currentStep + 1) / survey.questions.length) * 100;

  return (
    <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto px-4 py-4 sm:py-6 relative overflow-hidden h-full">
      {/* Header and Progress (Fixed height portion) */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex-shrink-0 mb-6 text-center"
      >
        <div className="w-full bg-gray-200 rounded-full h-2 max-w-2xl mx-auto overflow-hidden">
          <motion.div 
            className="bg-[var(--color-cyc-primary)] h-full" 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
        <p className="text-xs sm:text-sm font-bold text-[var(--color-cyc-secondary)] mt-3">
          Question {currentStep + 1} of {survey.questions.length}
        </p>
      </motion.div>

      {/* Interactive Question Card (Flex-1 to take remaining space, scrolling internal if absolutely needed) */}
      <div className="flex-1 flex flex-col card p-4 sm:p-8 shadow-xl border-t-4 border-t-[var(--color-cyc-accent)] relative overflow-hidden h-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial="initial"
            animate="in"
            exit="out"
            variants={pageVariants}
            transition={pageTransition}
            className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full overflow-y-auto no-scrollbar pb-4"
          >
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 sm:mb-8 text-[var(--color-cyc-secondary)] text-center leading-snug pt-4">
              {currentQuestion.question_text}
            </h2>
            
            <div className="w-full">
              {currentQuestion.type === 'multiple_choice' && (
                <div className="space-y-3 sm:space-y-4">
                  {currentQuestion.options.map((opt: string) => (
                    <label 
                      key={opt} 
                      className={`flex items-center p-3 sm:p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:shadow-md ${answers[currentQuestion.id] === opt ? 'border-[var(--color-cyc-primary)] bg-teal-50' : 'border-gray-100 hover:border-teal-200 bg-white'}`}
                    >
                      <input 
                        type="radio" 
                        name={currentQuestion.id} 
                        value={opt}
                        checked={answers[currentQuestion.id] === opt}
                        onChange={(e) => setAnswers({...answers, [currentQuestion.id]: e.target.value})}
                        className="sr-only"
                      />
                      <div className={`w-5 h-5 rounded-full border-2 mr-3 sm:mr-4 flex-shrink-0 flex items-center justify-center ${answers[currentQuestion.id] === opt ? 'border-[var(--color-cyc-primary)]' : 'border-gray-300'}`}>
                        {answers[currentQuestion.id] === opt && <div className="w-2.5 h-2.5 bg-[var(--color-cyc-primary)] rounded-full" />}
                      </div>
                      <span className="text-base sm:text-lg font-medium text-gray-700">{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {currentQuestion.type === 'rating_scale' && (
                <div className="py-8 px-4 sm:px-8 flex flex-col items-center">
                  <div className="text-4xl sm:text-5xl font-extrabold text-[var(--color-cyc-primary)] mb-6">
                    {answers[currentQuestion.id] !== undefined ? answers[currentQuestion.id] : 50}%
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={answers[currentQuestion.id] !== undefined ? answers[currentQuestion.id] : 50}
                    onChange={(e) => setAnswers({...answers, [currentQuestion.id]: Number(e.target.value)})}
                    className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[var(--color-cyc-primary)]"
                    style={{ background: `linear-gradient(to right, var(--color-cyc-primary) ${answers[currentQuestion.id] !== undefined ? answers[currentQuestion.id] : 50}%, #e5e7eb ${answers[currentQuestion.id] !== undefined ? answers[currentQuestion.id] : 50}%)` }}
                  />
                  <div className="w-full flex justify-between text-sm text-gray-500 mt-4 font-medium">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              )}

              {currentQuestion.type === 'checkboxes' && (
                <div className="space-y-3 sm:space-y-4">
                  {(() => {
                    const isObject = !Array.isArray(currentQuestion.options);
                    const choices = isObject ? currentQuestion.options.choices : currentQuestion.options;
                    const maxSelections = isObject ? currentQuestion.options.max_selections : undefined;
                    const currentSelected = answers[currentQuestion.id] || [];

                    return (
                      <>
                        {maxSelections && (
                          <p className="text-sm text-gray-500 font-medium mb-3">
                            Select up to {maxSelections} options
                          </p>
                        )}
                        {choices.map((opt: string) => {
                          const isChecked = currentSelected.includes(opt);
                          const isDisabled = !isChecked && maxSelections && currentSelected.length >= maxSelections;

                          return (
                            <label 
                              key={opt} 
                              className={`flex items-center p-3 sm:p-4 border-2 rounded-xl transition-all duration-200 ${isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200' : 'cursor-pointer hover:shadow-md'} ${isChecked ? 'border-[var(--color-cyc-primary)] bg-teal-50' : (!isDisabled ? 'border-gray-100 hover:border-teal-200 bg-white' : '')}`}
                            >
                              <input 
                                type="checkbox" 
                                value={opt}
                                checked={isChecked}
                                disabled={isDisabled}
                                onChange={(e) => {
                                  if (isDisabled) return;
                                  if (e.target.checked) {
                                    setAnswers({...answers, [currentQuestion.id]: [...currentSelected, opt]});
                                  } else {
                                    setAnswers({...answers, [currentQuestion.id]: currentSelected.filter((item: string) => item !== opt)});
                                  }
                                }}
                                className="sr-only"
                              />
                              <div className={`w-6 h-6 rounded border-2 mr-3 sm:mr-4 flex-shrink-0 flex items-center justify-center transition-colors ${isChecked ? 'bg-[var(--color-cyc-primary)] border-[var(--color-cyc-primary)]' : 'border-gray-300 bg-white'}`}>
                                {isChecked && <CheckCircle2 className="w-4 h-4 text-white" />}
                              </div>
                              <span className="text-base sm:text-lg font-medium text-gray-700">{opt}</span>
                            </label>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
              )}

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
                        <input
                          type="radio"
                          name={currentQuestion.id}
                          value={val}
                          checked={answers[currentQuestion.id] === val}
                          onChange={() => setAnswers({...answers, [currentQuestion.id]: val})}
                          className="sr-only"
                        />
                        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-4 transition-all duration-300 bg-white shadow-sm ${answers[currentQuestion.id] === val ? 'border-[var(--color-cyc-primary)] scale-125 shadow-md shadow-teal-100 text-[var(--color-cyc-primary)]' : 'border-gray-300 group-hover:border-teal-200 text-gray-500 group-hover:text-teal-500 group-hover:scale-110'}`}>
                          <span className="text-base sm:text-lg font-extrabold">{val}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {currentQuestion.type === 'short_answer' && (
                <textarea 
                  rows={4}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-[var(--color-cyc-primary)] focus:ring-4 focus:ring-teal-50 focus:outline-none transition-all resize-none text-base sm:text-lg"
                  placeholder="Share your thoughts here..."
                  value={answers[currentQuestion.id] || ''}
                  onChange={(e) => setAnswers({...answers, [currentQuestion.id]: e.target.value})}
                />
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Controls (Fixed at bottom of card) */}
        <div className="flex-shrink-0 flex justify-between items-center mt-6 pt-4 border-t border-gray-100 bg-white">
          <button 
            onClick={handleBack} 
            disabled={currentStep === 0}
            className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-medium transition-all ${currentStep === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
          >
            Back
          </button>
          
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleNext}
            disabled={submitting}
            className="btn-primary px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl flex items-center text-base sm:text-lg font-bold shadow-lg shadow-yellow-200 hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            {submitting ? 'Submitting...' : (currentStep === survey.questions.length - 1 ? 'Finish Survey' : 'Next')}
            {!submitting && currentStep !== survey.questions.length - 1 && <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />}
            {!submitting && currentStep === survey.questions.length - 1 && <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
