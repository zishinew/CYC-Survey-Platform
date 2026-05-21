"use client";
import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle2, FileText, Download } from 'lucide-react';

export default function SurveyPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const referralSource = searchParams.get('ref') || null;
  const [survey, setSurvey] = useState<any>(null);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); // 0 = email, 1+ = questions
  const [email, setEmail] = useState('');
  const [profileData, setProfileData] = useState<Record<string, any>>({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
  const [refNumbers, setRefNumbers] = useState<Record<string, number | undefined>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [inactivityTriggered, setInactivityTriggered] = useState(false);
  const [inactivityChecksShown, setInactivityChecksShown] = useState(0);
  const [questionEnterTime, setQuestionEnterTime] = useState<number>(Date.now());
  const [timeSpentAccumulator, setTimeSpentAccumulator] = useState<Record<string, number>>({});


  // Initialize email from URL or global cache
  useEffect(() => {
    const urlEmail = searchParams.get('email');
    if (urlEmail) {
      setEmail(urlEmail);
    } else {
      const globalEmail = localStorage.getItem('cyc_global_email');
      if (globalEmail) setEmail(globalEmail);
    }
  }, [searchParams]);


  // Inactivity tracking
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    
    const resetTimer = () => {
      clearTimeout(timeout);
      if (currentStep > 0 && !inactivityTriggered && inactivityChecksShown < 1) {
        timeout = setTimeout(() => {
          setInactivityTriggered(true);
        }, 60000);
      }
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('scroll', resetTimer);
    window.addEventListener('click', resetTimer);
    resetTimer();

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('scroll', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [currentStep, inactivityTriggered, inactivityChecksShown]);

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

        // Handle attention check injections
        let finalQuestions = data.questions || [];
        let loadedSaved = false;

        // Auto-resume from localStorage if present
        const savedSession = localStorage.getItem(`cyc_session_${data.id}`);
        if (savedSession) {
          try {
            const parsed = JSON.parse(savedSession);
            if (parsed.sessionId) {
              setSessionId(parsed.sessionId);
              setEmail(parsed.email || '');
              setAnswers(parsed.answers || {});
              setOtherTexts(parsed.otherTexts || {});
              setRefNumbers(parsed.refNumbers || {});
              setCurrentStep(parsed.currentStep !== undefined ? parsed.currentStep : 1);
              if (parsed.inactivityChecksShown) setInactivityChecksShown(parsed.inactivityChecksShown);
              if (parsed.injectedQuestions) {
                finalQuestions = parsed.injectedQuestions;
              }
              setHasStarted(true);
              loadedSaved = true;
            }
          } catch (e) {
            console.error("Failed to parse cached session", e);
          }
        }
        
        if (!loadedSaved && finalQuestions.length > 3) {
            const total = finalQuestions.length;
            const p1 = Math.floor(total * 0.25);
            const p2 = Math.floor(total * 0.5);
            const p3 = Math.floor(total * 0.75);
            
            const q1Index = p1 + Math.floor(Math.random() * Math.max(1, p2 - p1));
            const q2Index = p2 + Math.floor(Math.random() * Math.max(1, p3 - p2));
            
            const attn1 = {
                id: 'attn-fixed-1',
                type: 'multiple_choice',
                question_text: 'When answering questions about housing and economic policy, it is important to read each statement carefully. To demonstrate that you are paying attention, please select the response option "4 (Agree)" for this specific question. \n\nHow strongly do you agree or disagree with the timeline of current federal infrastructure projects?',
                is_required: true,
                options: { choices: ["1 (Strongly disagree)", "2 (Disagree)", "3 (Neutral)", "4 (Agree)", "5 (Strongly agree)"] }
            };
            const attn2 = {
                id: 'attn-fixed-2',
                type: 'multiple_choice',
                question_text: 'To ensure our data quality standards are met for this study, please answer the following straightforward statement: \n\n"The government of Canada has officially dissolved the country\'s currency and banned the exchange of all goods and services."',
                is_required: true,
                options: { choices: ["True", "False"] }
            };
            
            finalQuestions.splice(q2Index, 0, attn2);
            finalQuestions.splice(q1Index, 0, attn1);
        }
        
        setSurvey({ ...data, questions: finalQuestions });
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching survey", err);
        setError("Survey not found or unavailable.");
        setLoading(false);
      });
  }, [params.id]);

  // Sync state changes to localStorage for robust resume support
  useEffect(() => {
    if (survey && sessionId) {
      localStorage.setItem(`cyc_session_${survey.id}`, JSON.stringify({
        sessionId,
        email,
        answers,
        otherTexts,
        refNumbers,
        currentStep,
        injectedQuestions: survey.questions,
        inactivityChecksShown
      }));
    }
  }, [survey, sessionId, email, answers, otherTexts, refNumbers, currentStep]);

  // Auto-save the active question's answer to the database in the background on change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentStep]);

  // Auto-advance for simple section headers
  useEffect(() => {
    const isEmailStep = currentStep === 0;
    const currentQ = survey && !isEmailStep ? survey.questions[currentStep - 1] : null;
    if (!isEmailStep && currentQ?.type === 'section_header') {
      const opts = getOpts(currentQ);
      if (!opts.description && (!opts.attachments || opts.attachments.length === 0)) {
        const timer = setTimeout(() => {
          handleNext();
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [currentStep, survey]);

  useEffect(() => {
    if (survey && sessionId && currentStep > 0) {
      const currentQuestion = survey.questions[currentStep - 1];
      if (currentQuestion && currentQuestion.type !== 'section_header' && !currentQuestion.id.startsWith('attn-')) {
        const val = answers[currentQuestion.id];
        if (val !== undefined) {
          const currentSessionTime = Date.now() - questionEnterTime;
          const body: any = { 
              question_id: currentQuestion.id,
              time_spent: Math.floor((timeSpentAccumulator[currentQuestion.id] || 0) + currentSessionTime)
          };
          if (currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'short_answer') {
            body.answer_text = val;
          } else if (currentQuestion.type === 'rating_scale' || currentQuestion.type === 'likert_scale') {
            body.answer_numeric = val;
          } else if (currentQuestion.type === 'checkboxes') {
            body.answer_options = val;
          }

          // Debounce text area auto-save to avoid spamming the DB on every single keystroke
          const delay = currentQuestion.type === 'short_answer' ? 1000 : 0;
          const timeout = setTimeout(() => {
            fetch(`/api/sessions/${sessionId}/answers`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            }).catch(() => {});
          }, delay);

          return () => clearTimeout(timeout);
        }
      }
    }
  }, [answers, sessionId, currentStep, survey]);

  // --- Derived State (Must be before early returns for hooks) ---
  const totalSteps = survey ? survey.questions.length + 1 : 0;
  const isEmailStep = currentStep === 0;
  const currentQuestion = survey && !isEmailStep ? survey.questions[currentStep - 1] : null;
  const progress = survey && totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  // Helper to shuffle array (Fisher-Yates)
  const shuffleArray = (array: string[]) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      // eslint-disable-next-line react-hooks/purity
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Helper to get options config
  const getOpts = (q: any) => {
    if (!q?.options) return { choices: [], has_other: false, max_selections: undefined, has_calculator: false, description: '', attachments: [], randomize_options: false, locked_choices: [], description_alignment: 'left' };
    if (Array.isArray(q.options)) return { choices: q.options, has_other: false, max_selections: undefined, has_calculator: false, description: '', attachments: [], randomize_options: false, locked_choices: [], description_alignment: 'left' };
    return {
      choices: q.options.choices || [],
      has_other: q.options.has_other || false,
      max_selections: q.options.max_selections,
      has_calculator: q.options.has_calculator || q.options.reference_number ? true : false,
      description: q.options.description || '',
      attachments: q.options.attachments || [],
      randomize_options: q.options.randomize_options || false,
      locked_choices: q.options.locked_choices || [],
      description_alignment: q.options.description_alignment || 'left'
    };
  };

  const opts = currentQuestion ? getOpts(currentQuestion) : getOpts(null);

  // Memoized shuffled choices to prevent re-shuffling on every state update
  const displayChoices = useMemo(() => {
    if (!opts.choices || opts.choices.length === 0) return [];
    if (opts.randomize_options) {
      const locked = opts.locked_choices || [];
      const nonLocked = opts.choices.filter((c: string) => !locked.includes(c));
      const shuffledNonLocked = shuffleArray(nonLocked);
      return opts.choices.map((c: string) => locked.includes(c) ? c : shuffledNonLocked.shift()!);
    }
    return opts.choices;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id]);

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

  // Save the current answer to backend
  const saveCurrentAnswer = async (sid: string, questionIdx: number) => {
    const question = survey.questions[questionIdx];
    if (!question || question.type === 'section_header' || question.id.startsWith('attn-')) return;
    const val = answers[question.id];
    if (val === undefined) return;

    const currentSessionTime = Date.now() - questionEnterTime;
    const body: any = { 
        question_id: question.id,
        time_spent: Math.floor((timeSpentAccumulator[question.id] || 0) + currentSessionTime)
    };
    if (question.type === 'multiple_choice' || question.type === 'short_answer') {
      body.answer_text = val;
    } else if (question.type === 'rating_scale' || question.type === 'likert_scale') {
      body.answer_numeric = val;
    } else if (question.type === 'checkboxes') {
      body.answer_options = val;
    }

    await fetch(`/api/sessions/${sid}/answers`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(() => {});
  };

  const getNextVisibleStep = (startStep: number, forward: boolean, pData = profileData) => {
    let next = startStep;
    while (next > 0 && next <= survey.questions.length) {
      const q = survey.questions[next - 1];
      if (q && q.is_conditional && pData[q.question_text]) {
        next = forward ? next + 1 : next - 1;
      } else {
        break;
      }
    }
    return next;
  };

  const handleNext = async () => {
    // Step 0: create/resume session
    if (currentStep === 0) {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert('Please enter a valid email address.');
        return;
      }
      try {
        // 1. Duplicate Prevention Check
        const statusRes = await fetch(`/api/surveys/${survey.id}/check-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const statusData = await statusRes.json();
        if (statusData.has_submitted) {
          setAlreadyCompleted(true);
          const completedSurveys = JSON.parse(localStorage.getItem('cyc_completed_surveys') || '[]');
          if (!completedSurveys.includes(survey.id)) {
            completedSurveys.push(survey.id);
            localStorage.setItem('cyc_completed_surveys', JSON.stringify(completedSurveys));
          }
          return;
        }

        // Save to global email memory
        localStorage.setItem('cyc_global_email', email);

        // 2. Fetch Profile Data
        let fetchedProfileData = profileData;
        if (Object.keys(profileData).length === 0) {
          const profileRes = await fetch(`/api/user/profile-data?email=${encodeURIComponent(email)}`);
          if (profileRes.ok) {
            fetchedProfileData = await profileRes.json();
            setProfileData(fetchedProfileData);
          }
        }

        const sessionBody: any = { email };
        if (referralSource) sessionBody.referral_source = referralSource;
        const res = await fetch(`/api/surveys/${survey.id}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sessionBody)
        });
        const data = await res.json();
        setSessionId(data.session_id);

        const newAnswers: Record<string, any> = {};
        if (data.resumed && data.saved_answers?.length > 0) {
          for (const a of data.saved_answers) {
            if (a.answer_options) newAnswers[a.question_id] = a.answer_options;
            else if (a.answer_numeric !== null && a.answer_numeric !== undefined) newAnswers[a.question_id] = a.answer_numeric;
            else if (a.answer_text) newAnswers[a.question_id] = a.answer_text;
          }
        }

        // Pre-fill conditional answers
        survey.questions.forEach((q: any) => {
          if (q.is_conditional && fetchedProfileData[q.question_text] && newAnswers[q.id] === undefined) {
            const past = fetchedProfileData[q.question_text];
            if (past.answer_options) newAnswers[q.id] = past.answer_options;
            else if (past.answer_numeric !== null) newAnswers[q.id] = past.answer_numeric;
            else if (past.answer_text) newAnswers[q.id] = past.answer_text;
          }
        });

        setAnswers(newAnswers);
        
        if (data.resumed && data.current_step > 0) {
           setCurrentStep(data.current_step);
        } else {
           setCurrentStep(getNextVisibleStep(1, true, fetchedProfileData));
        }
        return;
      } catch {
        alert('Failed to start session. Please try again.');
        return;
      }
    }

    // Evaluate attention check if applicable
    if (currentStep > 0 && currentStep <= survey.questions.length) {
      const q = survey.questions[currentStep - 1];
      if (q.id.startsWith('attn-')) {
        const val = answers[q.id];
        let passed = false;
        if (q.id === 'attn-fixed-1' && val === '4 (Agree)') passed = true;
        if (q.id === 'attn-fixed-2' && val === 'False') passed = true;
        if (q.id === 'attn-inact-1' && val === 'Yes') passed = true;
        
        if (!passed && sessionId) {
            fetch(`/api/sessions/${sessionId}/attention-failure`, { method: 'POST' }).catch(()=>console.error("Failed to report attn"));
        }
      }
    }
    
    // Inject inactivity check dynamically
    if (inactivityTriggered && inactivityChecksShown < 1 && survey && currentStep > 0) {
        const attnInact = {
            id: 'attn-inact-1',
            type: 'multiple_choice',
            question_text: 'Are you still there? Please select "Yes" to continue.',
            is_required: true,
            options: { choices: ["No", "Yes", "Maybe"] }
        };
        const newQs = [...survey.questions];
        newQs.splice(currentStep, 0, attnInact);
        
        setSurvey((prev: any) => ({ ...prev, questions: newQs }));
        setInactivityChecksShown(prev => prev + 1);
        setInactivityTriggered(false);
    }

    // Validate required questions before moving
    if (currentStep > 0 && currentStep <= survey.questions.length) {
      const q = survey.questions[currentStep - 1];
      if (q.is_required && q.type !== 'section_header') {
        const val = answers[q.id];
        if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          alert('This question is required. Please provide an answer.');
          return;
        }
      }
    }

    // Save current answer before moving
    if (sessionId) {
      await saveCurrentAnswer(sessionId, currentStep - 1);
      
      const nextStep = getNextVisibleStep(currentStep + 1, true);
      
      // Update step on server
      fetch(`/api/sessions/${sessionId}/step`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_step: nextStep })
      }).catch(() => {});
      
      if (currentStep > 0 && currentStep <= survey.questions.length) {
          const qId = survey.questions[currentStep - 1].id;
          setTimeSpentAccumulator((prev: any) => ({ ...prev, [qId]: (prev[qId] || 0) + (Date.now() - questionEnterTime) }));
      }
      setQuestionEnterTime(Date.now());
      if (nextStep <= survey.questions.length) {
        setCurrentStep(nextStep);
      } else {
        await finishSurvey();
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      if (survey && survey.questions[currentStep - 1]) {
          const qId = survey.questions[currentStep - 1].id;
          setTimeSpentAccumulator((prev: any) => ({ ...prev, [qId]: (prev[qId] || 0) + (Date.now() - questionEnterTime) }));
      }
      setQuestionEnterTime(Date.now());
      setCurrentStep(Math.max(0, getNextVisibleStep(currentStep - 1, false)));
    }
  };

  const finishSurvey = async () => {
    setSubmitting(true);
    try {
      if (sessionId) {
        // Save last answer then mark complete
        await saveCurrentAnswer(sessionId, currentStep - 1);
        await fetch(`/api/sessions/${sessionId}/complete`, { method: 'PATCH' });
      }

      const completedSurveys = JSON.parse(localStorage.getItem('cyc_completed_surveys') || '[]');
      if (!completedSurveys.includes(survey.id)) {
        completedSurveys.push(survey.id);
        localStorage.setItem('cyc_completed_surveys', JSON.stringify(completedSurveys));
      }
      
      // Clear the saved session cache upon successful completion
      localStorage.removeItem(`cyc_session_${survey.id}`);
      
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
          <p className={`text-lg sm:text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed text-${survey.description_alignment || 'left'}`}>
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
  return (
    <div className="flex-1 flex flex-col w-full max-w-4xl mx-auto px-4 py-4 sm:py-6 relative min-h-full pb-20">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex-shrink-0 mb-6 text-center">
        <div className="w-full bg-gray-200 rounded-full h-2 max-w-2xl mx-auto overflow-hidden">
          <motion.div className="bg-[var(--color-cyc-primary)] h-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5, ease: "easeOut" }} />
        </div>
        <p className="text-xs sm:text-sm font-bold text-[var(--color-cyc-secondary)] mt-3">
          {isEmailStep ? 'Before we begin' : (currentQuestion?.type === 'section_header' ? 'Information' : `Question ${currentStep} of ${survey.questions.length}`)}
        </p>
      </motion.div>

      <div className="flex-1 flex flex-col card p-4 sm:p-8 shadow-xl border-t-4 border-t-[var(--color-cyc-accent)] relative h-auto min-h-[60vh]">
        <AnimatePresence mode="wait">
          <motion.div key={currentStep} initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition}
            className={`flex-1 flex flex-col max-w-2xl mx-auto w-full pb-4 pt-4 sm:pt-8 ${currentQuestion?.type === "section_header" ? "justify-center my-auto" : "justify-start"}`}>
            
            {/* EMAIL STEP */}
            {isEmailStep && (
              <>
                <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 sm:mb-8 text-[var(--color-cyc-secondary)] text-center leading-snug pt-4">
                  What is your email address?
                </h2>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl focus:border-[var(--color-cyc-primary)] focus:ring-4 focus:ring-teal-50 focus:outline-none transition-all text-base sm:text-lg text-center"
                  placeholder="you@example.com"
                />
                <p className="text-xs text-gray-400 text-center mt-3">Your email will be kept confidential and is used only for tracking responses.</p>
              </>
            )}

            {/* QUESTION STEPS */}
            {!isEmailStep && currentQuestion && (
              <>
            <div className="mb-6 sm:mb-8 text-center pt-4">
              {(currentQuestion.question_text || '').split('\n\n').map((part: string, i: number, arr: string[]) => (
                <div key={i} className={i < arr.length - 1 ? "text-sm sm:text-base text-gray-600 font-medium mb-6 leading-relaxed max-w-2xl mx-auto" : "text-xl sm:text-2xl md:text-3xl font-bold text-[var(--color-cyc-secondary)] leading-snug"}>
                  {part}
                </div>
              ))}
            </div>
            
            <div className="w-full">
              {/* SECTION HEADER */}
              {currentQuestion.type === 'section_header' && (
                <div className="space-y-4">
                  {opts.description && (
                    <p className={`text-base text-gray-600 leading-relaxed whitespace-pre-wrap text-${opts.description_alignment || 'left'}`}>
                      {opts.description}
                    </p>
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

              {/* DROPDOWN */}
              {currentQuestion.type === 'dropdown' && (
                <div className="w-full">
                  <select
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => setAnswers({...answers, [currentQuestion.id]: e.target.value})}
                    className="w-full p-3 sm:p-4 border-2 border-gray-200 rounded-xl focus:border-[var(--color-cyc-primary)] focus:ring-4 focus:ring-teal-50 focus:outline-none transition-all text-base sm:text-lg bg-white cursor-pointer"
                  >
                    <option value="" disabled>Select an option...</option>
                    {displayChoices.map((opt: string) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* MULTIPLE CHOICE */}
              {currentQuestion.type === 'multiple_choice' && (
                <div className="space-y-3 sm:space-y-4">
                  {displayChoices.map((opt: string) => (
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
                        {displayChoices.map((opt: string) => {
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
            </>
            )}
              {!(currentQuestion?.type === 'section_header' && !opts.description && (!opts.attachments || opts.attachments.length === 0)) && (
                <div className="flex-shrink-0 flex justify-between items-center mt-auto pt-6 border-t border-gray-100 bg-white">
                  <button onClick={handleBack} disabled={currentStep === 0}
                    className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-medium transition-all ${currentStep === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                    Back
                  </button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleNext} disabled={submitting}
                    className="btn-primary px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl flex items-center text-base sm:text-lg font-bold shadow-lg shadow-yellow-200 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                    {submitting ? 'Submitting...' : (currentStep === totalSteps - 1 ? 'Finish Survey' : (isEmailStep ? 'Next' : (currentQuestion?.type === 'section_header' ? 'Continue' : 'Next')))}
                    {!submitting && currentStep !== totalSteps - 1 && <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />}
                    {!submitting && currentStep === totalSteps - 1 && <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />}
                  </motion.button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    );
  }
