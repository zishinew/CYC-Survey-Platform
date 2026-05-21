import re
file_path = "src/app/survey/[id]/page.tsx"
with open(file_path, "r") as f:
    content = f.read()

# 1. Add state variables
old_state = """  const [inactivityTriggered, setInactivityTriggered] = useState(false);
  const [inactivityChecksShown, setInactivityChecksShown] = useState(0);"""
new_state = """  const [inactivityTriggered, setInactivityTriggered] = useState(false);
  const [inactivityChecksShown, setInactivityChecksShown] = useState(0);
  const [questionEnterTime, setQuestionEnterTime] = useState<number>(Date.now());
  const [timeSpentAccumulator, setTimeSpentAccumulator] = useState<Record<string, number>>({});"""
content = content.replace(old_state, new_state)

# 2. Update saveCurrentAnswer to include time_spent
old_save = """    const body: any = { question_id: question.id };
    if (question.type === 'multiple_choice' || question.type === 'short_answer') {"""
new_save = """    const currentSessionTime = Date.now() - questionEnterTime;
    const body: any = { 
        question_id: question.id,
        time_spent: Math.floor((timeSpentAccumulator[question.id] || 0) + currentSessionTime)
    };
    if (question.type === 'multiple_choice' || question.type === 'short_answer') {"""
content = content.replace(old_save, new_save)

# 3. Update auto-save in useEffect to include time_spent
old_autosave = """          const body: any = { question_id: currentQuestion.id };
          if (currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'short_answer') {"""
new_autosave = """          const currentSessionTime = Date.now() - questionEnterTime;
          const body: any = { 
              question_id: currentQuestion.id,
              time_spent: Math.floor((timeSpentAccumulator[currentQuestion.id] || 0) + currentSessionTime)
          };
          if (currentQuestion.type === 'multiple_choice' || currentQuestion.type === 'short_answer') {"""
content = content.replace(old_autosave, new_autosave)

# 4. Handle step change time accumulation
# In handleNext:
old_next_step = """      if (nextStep <= survey.questions.length) {
        setCurrentStep(nextStep);
      } else {"""
new_next_step = """      if (currentStep > 0 && currentStep <= survey.questions.length) {
          const qId = survey.questions[currentStep - 1].id;
          setTimeSpentAccumulator((prev: any) => ({ ...prev, [qId]: (prev[qId] || 0) + (Date.now() - questionEnterTime) }));
      }
      setQuestionEnterTime(Date.now());
      if (nextStep <= survey.questions.length) {
        setCurrentStep(nextStep);
      } else {"""
content = content.replace(old_next_step, new_next_step)

# In handleBack:
old_back = """  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(Math.max(0, getNextVisibleStep(currentStep - 1, false)));
    }
  };"""
new_back = """  const handleBack = () => {
    if (currentStep > 0) {
      if (survey && survey.questions[currentStep - 1]) {
          const qId = survey.questions[currentStep - 1].id;
          setTimeSpentAccumulator((prev: any) => ({ ...prev, [qId]: (prev[qId] || 0) + (Date.now() - questionEnterTime) }));
      }
      setQuestionEnterTime(Date.now());
      setCurrentStep(Math.max(0, getNextVisibleStep(currentStep - 1, false)));
    }
  };"""
content = content.replace(old_back, new_back)

with open(file_path, "w") as f:
    f.write(content)

print("Survey time tracking patched")
