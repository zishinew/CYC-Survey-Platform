import re

file_path = "src/app/survey/[id]/page.tsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Add state variables
state_vars = """
  const [inactivityTriggered, setInactivityTriggered] = useState(false);
  const [inactivityChecksShown, setInactivityChecksShown] = useState(0);
"""
content = re.sub(r'(const \[error, setError\] = useState\(\'\'\);)', r'\1\n' + state_vars, content)

# 2. Modify local storage save to include injectedQuestions, inactivityChecksShown
old_ls_save = """      localStorage.setItem(`cyc_session_${survey.id}`, JSON.stringify({
        sessionId,
        email,
        answers,
        otherTexts,
        refNumbers,
        currentStep
      }));"""
new_ls_save = """      localStorage.setItem(`cyc_session_${survey.id}`, JSON.stringify({
        sessionId,
        email,
        answers,
        otherTexts,
        refNumbers,
        currentStep,
        injectedQuestions: survey.questions,
        inactivityChecksShown
      }));"""
content = content.replace(old_ls_save, new_ls_save)

# 3. Add Inactivity useEffect
inactivity_effect = """
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
"""
# Insert before the _gather_survey_data effect (which is the main fetch) or right after the searchParams effect
content = re.sub(r'(  useEffect\(\(\) => \{\n    fetch\(`/api/surveys/\$\{params.id\}`\))', inactivity_effect + r'\n\1', content)

# 4. Modify fetch logic to load injected questions or create them
old_fetch = """        // Auto-resume from localStorage if present
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
              setHasStarted(true);
            }
          } catch (e) {
            console.error("Failed to parse cached session", e);
          }
        }
        
        setLoading(false);"""

new_fetch = """        // Handle attention check injections
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
                question_text: 'This is an attention check. Please select "Agree" to continue.',
                is_required: true,
                options: { choices: ["Disagree", "Agree", "Neutral"] }
            };
            const attn2 = {
                id: 'attn-fixed-2',
                type: 'multiple_choice',
                question_text: 'To make sure you are still reading, please choose "Blue".',
                is_required: true,
                options: { choices: ["Red", "Blue", "Green"] }
            };
            
            finalQuestions.splice(q2Index, 0, attn2);
            finalQuestions.splice(q1Index, 0, attn1);
        }
        
        setSurvey({ ...data, questions: finalQuestions });
        setLoading(false);"""
content = content.replace(old_fetch, new_fetch)

# 5. Prevent backend saves for attn- questions
content = content.replace(
    "if (currentQuestion && currentQuestion.type !== 'section_header') {",
    "if (currentQuestion && currentQuestion.type !== 'section_header' && !currentQuestion.id.startsWith('attn-')) {"
)

content = content.replace(
    "if (!question || question.type === 'section_header') return;",
    "if (!question || question.type === 'section_header' || question.id.startsWith('attn-')) return;"
)

# 6. Evaluate attention check and inject inactivity check on Next
old_next = """    // Validate required questions before moving
    if (currentStep > 0 && currentStep <= survey.questions.length) {
      const q = survey.questions[currentStep - 1];"""

new_next = """    // Evaluate attention check if applicable
    if (currentStep > 0 && currentStep <= survey.questions.length) {
      const q = survey.questions[currentStep - 1];
      if (q.id.startsWith('attn-')) {
        const val = answers[q.id];
        let passed = false;
        if (q.id === 'attn-fixed-1' && val === 'Agree') passed = true;
        if (q.id === 'attn-fixed-2' && val === 'Blue') passed = true;
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
        
        setSurvey(prev => ({ ...prev, questions: newQs }));
        setInactivityChecksShown(prev => prev + 1);
        setInactivityTriggered(false);
    }

    // Validate required questions before moving
    if (currentStep > 0 && currentStep <= survey.questions.length) {
      const q = survey.questions[currentStep - 1];"""

content = content.replace(old_next, new_next)

with open(file_path, "w") as f:
    f.write(content)

print("Patched survey page successfully.")
