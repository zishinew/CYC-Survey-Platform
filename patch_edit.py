import re

with open("src/app/admin/edit/[id]/page.tsx", "r") as f:
    content = f.read()

# 1. State changes
content = content.replace("const [language, setLanguage] = useState<'en' | 'fr'>('en');", "const [language, setLanguage] = useState<'en' | 'fr' | 'zh'>('en');")
content = content.replace("const [titleFr, setTitleFr] = useState('');", "const [titleFr, setTitleFr] = useState('');\n  const [titleZh, setTitleZh] = useState('');")
content = content.replace("const [descriptionFr, setDescriptionFr] = useState('');", "const [descriptionFr, setDescriptionFr] = useState('');\n  const [descriptionZh, setDescriptionZh] = useState('');")

# 2. Type definitions - edit/[id]/page.tsx doesn't have the QuestionDraft interface if it imports it, let's check
# Wait, QuestionDraft is defined in edit/[id]/page.tsx too?
# Let's search and replace if it exists
if "question_text_fr?: string;" in content:
    content = content.replace(
"""  question_text_fr?: string;
  options_fr?: any;
  section_description_fr?: string;
  definitions_fr?: any;""",
"""  question_text_fr?: string;
  options_fr?: any;
  section_description_fr?: string;
  definitions_fr?: any;
  question_text_zh?: string;
  options_zh?: any;
  section_description_zh?: string;
  definitions_zh?: any;"""
    )

# 3. useEffect loading logic
old_useeffect = """        setTitleFr(transData?.title_fr || '');
        setDescriptionFr(transData?.description_fr || '');

        const frQuestions = transData.questions_fr || [];
        
        // Map questions
        const loadedQuestions = data.questions.map((q: any) => {
          const frQ = frQuestions.find((fq: any) => fq.id === q.id) || {};
          const isArr = !q.options || Array.isArray(q.options);
          const isFrArr = !frQ.options || Array.isArray(frQ.options);
          
          return {
            id: q.id, // Use real ID so we can match properly, or a stable one
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
            definitions: !isArr ? q.options.definitions : undefined,
            
            // French fields
            question_text_fr: frQ.question_text || '',
            options_fr: isFrArr ? (frQ.options || []) : (frQ.options?.choices || []),
            section_description_fr: (!isFrArr && frQ.options?.description) ? frQ.options.description : '',
            definitions_fr: !isFrArr ? frQ.options?.definitions : undefined
          };
        });"""

new_useeffect = """        setTitleFr(transData?.title_fr || '');
        setDescriptionFr(transData?.description_fr || '');
        setTitleZh(transData?.title_zh || '');
        setDescriptionZh(transData?.description_zh || '');

        const frQuestions = transData.questions_fr || [];
        const zhQuestions = transData.questions_zh || [];
        
        // Map questions
        const loadedQuestions = data.questions.map((q: any) => {
          const frQ = frQuestions.find((fq: any) => fq.id === q.id) || {};
          const zhQ = zhQuestions.find((zq: any) => zq.id === q.id) || {};
          const isArr = !q.options || Array.isArray(q.options);
          const isFrArr = !frQ.options || Array.isArray(frQ.options);
          const isZhArr = !zhQ.options || Array.isArray(zhQ.options);
          
          return {
            id: q.id, // Use real ID so we can match properly, or a stable one
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
            definitions: !isArr ? q.options.definitions : undefined,
            
            // French fields
            question_text_fr: frQ.question_text || '',
            options_fr: isFrArr ? (frQ.options || []) : (frQ.options?.choices || []),
            section_description_fr: (!isFrArr && frQ.options?.description) ? frQ.options.description : '',
            definitions_fr: !isFrArr ? frQ.options?.definitions : undefined,
            
            // Chinese fields
            question_text_zh: zhQ.question_text || '',
            options_zh: isZhArr ? (zhQ.options || []) : (zhQ.options?.choices || []),
            section_description_zh: (!isZhArr && zhQ.options?.description) ? zhQ.options.description : '',
            definitions_zh: !isZhArr ? zhQ.options?.definitions : undefined
          };
        });"""
content = content.replace(old_useeffect, new_useeffect)

# 4. getOptionsForDisplay
old_getOptions = """  const getOptionsForDisplay = (q: QuestionDraft): string[] => {
    if (language === 'fr') {
      const frOptions = getOptionsArray(q.options_fr);
      if (frOptions.length > 0) return frOptions;
      return getOptionsArray(q.options);
    }
    return getOptionsArray(q.options);
  };"""

new_getOptions = """  const getOptionsForDisplay = (q: QuestionDraft): string[] => {
    if (language === 'fr') {
      const frOptions = getOptionsArray(q.options_fr);
      if (frOptions.length > 0) return frOptions;
    } else if (language === 'zh') {
      const zhOptions = getOptionsArray(q.options_zh);
      if (zhOptions.length > 0) return zhOptions;
    }
    return getOptionsArray(q.options);
  };"""
content = content.replace(old_getOptions, new_getOptions)

# 5. updateOption
old_updateOpt = """  const updateOption = (qId: string, index: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id !== qId) return q;
      if (language === 'fr') {
        const base = getOptionsArray(q.options_fr);
        const arr = (base.length > 0 ? base : getOptionsArray(q.options)).slice();
        arr[index] = value;
        return { ...q, options_fr: arr };
      } else {
        const arr = getOptionsArray(q.options).slice();
        arr[index] = value;
        return { ...q, options: arr };
      }
    }));
  };"""

new_updateOpt = """  const updateOption = (qId: string, index: number, value: string) => {
    setQuestions(questions.map(q => {
      if (q.id !== qId) return q;
      if (language === 'fr') {
        const base = getOptionsArray(q.options_fr);
        const arr = (base.length > 0 ? base : getOptionsArray(q.options)).slice();
        arr[index] = value;
        return { ...q, options_fr: arr };
      } else if (language === 'zh') {
        const base = getOptionsArray(q.options_zh);
        const arr = (base.length > 0 ? base : getOptionsArray(q.options)).slice();
        arr[index] = value;
        return { ...q, options_zh: arr };
      } else {
        const arr = getOptionsArray(q.options).slice();
        arr[index] = value;
        return { ...q, options: arr };
      }
    }));
  };"""
content = content.replace(old_updateOpt, new_updateOpt)

# 6. updateDefinition
old_updateDef = """  const updateDefinition = (qId: string, index: number, field: 'term' | 'definition', value: string) => {
    setQuestions(questions.map(q => {
      if (q.id !== qId) return q;
      if (language === 'fr') {
        const arr = [...(q.definitions_fr || q.definitions || [])];
        if (!arr[index]) arr[index] = { term: '', definition: '' };
        arr[index] = { ...arr[index], [field]: value };
        return { ...q, definitions_fr: arr };
      } else {
        const arr = [...(q.definitions || [])];
        if (!arr[index]) arr[index] = { term: '', definition: '' };
        arr[index] = { ...arr[index], [field]: value };
        return { ...q, definitions: arr };
      }
    }));
  };"""

new_updateDef = """  const updateDefinition = (qId: string, index: number, field: 'term' | 'definition', value: string) => {
    setQuestions(questions.map(q => {
      if (q.id !== qId) return q;
      if (language === 'fr') {
        const arr = [...(q.definitions_fr || q.definitions || [])];
        if (!arr[index]) arr[index] = { term: '', definition: '' };
        arr[index] = { ...arr[index], [field]: value };
        return { ...q, definitions_fr: arr };
      } else if (language === 'zh') {
        const arr = [...(q.definitions_zh || q.definitions || [])];
        if (!arr[index]) arr[index] = { term: '', definition: '' };
        arr[index] = { ...arr[index], [field]: value };
        return { ...q, definitions_zh: arr };
      } else {
        const arr = [...(q.definitions || [])];
        if (!arr[index]) arr[index] = { term: '', definition: '' };
        arr[index] = { ...arr[index], [field]: value };
        return { ...q, definitions: arr };
      }
    }));
  };"""
content = content.replace(old_updateDef, new_updateDef)

# 7. handleSubmit payload
old_payloadFr = """      // Also generate and save French translation payload
      const payload_fr = payload.questions.map((q, idx) => {
        const draftQ = questions[idx];
        const updatedQ = isLocked ? draftQ : updatedSurvey.questions?.[idx];
        let optionsFr: any = null;
        if (q.type === 'multiple_choice' || q.type === 'dropdown') {
          optionsFr = { choices: draftQ.options_fr || q.options?.choices || [], has_other: q.options?.has_other || false, randomize_options: q.options?.randomize_options || false, locked_choices: q.options?.locked_choices || [] };
        } else if (q.type === 'checkboxes') {
          optionsFr = { choices: draftQ.options_fr || q.options?.choices || [], max_selections: q.options?.max_selections, has_other: q.options?.has_other || false, randomize_options: q.options?.randomize_options || false, locked_choices: q.options?.locked_choices || [] };
        } else if (q.type === 'rating_scale' && draftQ.reference_number) {
          optionsFr = { has_calculator: true };
        } else if (q.type === 'section_header') {
          optionsFr = { description: draftQ.section_description_fr || draftQ.section_description || '', attachments: draftQ.attachments || [], description_alignment: draftQ.description_alignment || 'left' };
        }
        if (draftQ.definitions_fr && draftQ.definitions_fr.length > 0) {
          if (!optionsFr) optionsFr = {};
          optionsFr.definitions = draftQ.definitions_fr;
        }
        return {
          id: updatedQ?.id,
          ...q,
          question_text: draftQ.question_text_fr || draftQ.question_text || '',
          options: optionsFr
        };
      });

      const filteredPayloadFr = payload_fr.filter((q: any) => q.id);
      if (filteredPayloadFr.length > 0) {
        const resFr = await fetch(`/api/surveys/${params.id}/translation`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questions_fr: filteredPayloadFr,
            title_fr: titleFr || '',
            description_fr: descriptionFr || ''
          })
        });

        if (!resFr.ok) {
          throw new Error('Failed to save French translations');
        }
      }"""

new_payload = """      // Also generate and save Translation payloads
      const payload_fr = payload.questions.map((q, idx) => {
        const draftQ = questions[idx];
        const updatedQ = isLocked ? draftQ : updatedSurvey.questions?.[idx];
        let optionsFr: any = null;
        if (q.type === 'multiple_choice' || q.type === 'dropdown') {
          optionsFr = { choices: draftQ.options_fr || q.options?.choices || [], has_other: q.options?.has_other || false, randomize_options: q.options?.randomize_options || false, locked_choices: q.options?.locked_choices || [] };
        } else if (q.type === 'checkboxes') {
          optionsFr = { choices: draftQ.options_fr || q.options?.choices || [], max_selections: q.options?.max_selections, has_other: q.options?.has_other || false, randomize_options: q.options?.randomize_options || false, locked_choices: q.options?.locked_choices || [] };
        } else if (q.type === 'rating_scale' && draftQ.reference_number) {
          optionsFr = { has_calculator: true };
        } else if (q.type === 'section_header') {
          optionsFr = { description: draftQ.section_description_fr || draftQ.section_description || '', attachments: draftQ.attachments || [], description_alignment: draftQ.description_alignment || 'left' };
        }
        if (draftQ.definitions_fr && draftQ.definitions_fr.length > 0) {
          if (!optionsFr) optionsFr = {};
          optionsFr.definitions = draftQ.definitions_fr;
        }
        return {
          id: updatedQ?.id,
          ...q,
          question_text: draftQ.question_text_fr || draftQ.question_text || '',
          options: optionsFr
        };
      });
      
      const payload_zh = payload.questions.map((q, idx) => {
        const draftQ = questions[idx];
        const updatedQ = isLocked ? draftQ : updatedSurvey.questions?.[idx];
        let optionsZh: any = null;
        if (q.type === 'multiple_choice' || q.type === 'dropdown') {
          optionsZh = { choices: draftQ.options_zh || q.options?.choices || [], has_other: q.options?.has_other || false, randomize_options: q.options?.randomize_options || false, locked_choices: q.options?.locked_choices || [] };
        } else if (q.type === 'checkboxes') {
          optionsZh = { choices: draftQ.options_zh || q.options?.choices || [], max_selections: q.options?.max_selections, has_other: q.options?.has_other || false, randomize_options: q.options?.randomize_options || false, locked_choices: q.options?.locked_choices || [] };
        } else if (q.type === 'rating_scale' && draftQ.reference_number) {
          optionsZh = { has_calculator: true };
        } else if (q.type === 'section_header') {
          optionsZh = { description: draftQ.section_description_zh || draftQ.section_description || '', attachments: draftQ.attachments || [], description_alignment: draftQ.description_alignment || 'left' };
        }
        if (draftQ.definitions_zh && draftQ.definitions_zh.length > 0) {
          if (!optionsZh) optionsZh = {};
          optionsZh.definitions = draftQ.definitions_zh;
        }
        return {
          id: updatedQ?.id,
          ...q,
          question_text: draftQ.question_text_zh || draftQ.question_text || '',
          options: optionsZh
        };
      });

      const filteredPayloadFr = payload_fr.filter((q: any) => q.id);
      const filteredPayloadZh = payload_zh.filter((q: any) => q.id);
      
      if (filteredPayloadFr.length > 0 || filteredPayloadZh.length > 0) {
        const transPayload: any = {};
        if (filteredPayloadFr.length > 0) {
          transPayload.questions_fr = filteredPayloadFr;
          transPayload.title_fr = titleFr || '';
          transPayload.description_fr = descriptionFr || '';
        }
        if (filteredPayloadZh.length > 0) {
          transPayload.questions_zh = filteredPayloadZh;
          transPayload.title_zh = titleZh || '';
          transPayload.description_zh = descriptionZh || '';
        }
        
        const resTrans = await fetch(`/api/surveys/${params.id}/translation`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(transPayload)
        });

        if (!resTrans.ok) {
          throw new Error('Failed to save translations');
        }
      }"""
content = content.replace(old_payloadFr, new_payload)


# 8. Tabs in UI
old_tabs = """        <div className="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${language === 'en' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLanguage('fr')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${language === 'fr' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            Français
          </button>
        </div>"""

new_tabs = """        <div className="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${language === 'en' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLanguage('fr')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${language === 'fr' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            Français
          </button>
          <button
            type="button"
            onClick={() => setLanguage('zh')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${language === 'zh' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            中文
          </button>
        </div>"""
content = content.replace(old_tabs, new_tabs)

# 9. Title Input
old_title = """            {language === 'fr' && (
              <div className="text-sm text-gray-500 dark:text-slate-400 mb-1 px-2 border-l-2 border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-2 rounded-r">
                {title || "No English title provided"}
              </div>
            )}
            <input
              type="text"
              required={language === 'en'}
              value={language === 'en' ? title : titleFr}
              onChange={(e) => language === 'en' ? setTitle(e.target.value) : setTitleFr(e.target.value)}
              disabled={isLocked && language === 'en'}
              className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none disabled:opacity-50"
              placeholder={language === 'fr' ? "Titre en francais" : "Survey Title"}
            />"""
new_title = """            {language !== 'en' && (
              <div className="text-sm text-gray-500 dark:text-slate-400 mb-1 px-2 border-l-2 border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-2 rounded-r">
                {title || "No English title provided"}
              </div>
            )}
            <input
              type="text"
              required={language === 'en'}
              value={language === 'en' ? title : language === 'fr' ? titleFr : titleZh}
              onChange={(e) => language === 'en' ? setTitle(e.target.value) : language === 'fr' ? setTitleFr(e.target.value) : setTitleZh(e.target.value)}
              disabled={isLocked && language === 'en'}
              className="w-full p-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none disabled:opacity-50"
              placeholder={language === 'fr' ? "Titre en francais" : language === 'zh' ? "调查标题" : "Survey Title"}
            />"""
content = content.replace(old_title, new_title)

# 10. Description Textarea
old_desc = """            {language === 'fr' && (
              <div className="text-sm text-gray-500 dark:text-slate-400 mb-1 px-2 border-l-2 border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-2 rounded-r whitespace-pre-wrap">
                {description || "No English description provided"}
              </div>
            )}
            <textarea
              value={language === 'en' ? description : descriptionFr}
              onChange={(e) => language === 'en' ? setDescription(e.target.value) : setDescriptionFr(e.target.value)}
              disabled={isLocked && language === 'en'}
              className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:border-transparent transition-all disabled:opacity-50"
              rows={4}
              placeholder={language === 'fr' ? "De quoi s'agit-il?" : "What is this survey about?"}
            />"""
new_desc = """            {language !== 'en' && (
              <div className="text-sm text-gray-500 dark:text-slate-400 mb-1 px-2 border-l-2 border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-2 rounded-r whitespace-pre-wrap">
                {description || "No English description provided"}
              </div>
            )}
            <textarea
              value={language === 'en' ? description : language === 'fr' ? descriptionFr : descriptionZh}
              onChange={(e) => language === 'en' ? setDescription(e.target.value) : language === 'fr' ? setDescriptionFr(e.target.value) : setDescriptionZh(e.target.value)}
              disabled={isLocked && language === 'en'}
              className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:border-transparent transition-all disabled:opacity-50"
              rows={4}
              placeholder={language === 'fr' ? "De quoi s'agit-il?" : language === 'zh' ? "关于什么？" : "What is this survey about?"}
            />"""
content = content.replace(old_desc, new_desc)

# 11. Banner Fixes for language !== 'en'
content = content.replace("{language === 'fr' && (", "{language !== 'en' && (")
# Note: I already did this for the create page, but here I can just replace the exact one:
# Wait, let's just make sure it replaces the correct ones. The ones inside JSX for title and description were replaced directly.
# The blue banner:
# {language === 'fr' && (
#   <div className="bg-blue-50 dark:bg-slate-800/50 text-blue-600 dark:text-blue-400 p-3 rounded-lg text-sm flex items-start">
content = content.replace(
"""          {language !== 'en' && (
            <div className="bg-blue-50 dark:bg-slate-800/50 text-blue-600 dark:text-blue-400 p-3 rounded-lg text-sm flex items-start">""",
"""          {language !== 'en' && (
            <div className="bg-blue-50 dark:bg-slate-800/50 text-blue-600 dark:text-blue-400 p-3 rounded-lg text-sm flex items-start">"""
) # Wait, previously I replaced "{language === 'fr' && (" with "{language !== 'en' && (". 
# I can just do:
content = content.replace(
"""          {language === 'fr' && (
            <div className="bg-blue-50 dark:bg-slate-800/50 text-blue-600 dark:text-blue-400 p-3 rounded-lg text-sm flex items-start">""",
"""          {language !== 'en' && (
            <div className="bg-blue-50 dark:bg-slate-800/50 text-blue-600 dark:text-blue-400 p-3 rounded-lg text-sm flex items-start">"""
)

# 12. Question Text Input
old_qtext = """                    <div className="flex-1 mr-4">
                      {language === 'fr' && (
                        <div className="text-sm text-gray-500 dark:text-slate-400 mb-1 px-2 border-l-2 border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-2 rounded-r">
                          {q.question_text || "No English question text provided"}
                        </div>
                      )}
                      <input
                        type="text"
                        required={language === 'en'}
                        value={language === 'en' ? q.question_text : (q.question_text_fr || '')}
                        onChange={(e) => updateQuestion(q.id, language === 'en' ? 'question_text' : 'question_text_fr', e.target.value)}
                        disabled={isLocked && language === 'en'}
                        placeholder={language === 'fr' ? "Traduction française" : "Question Text"}
                        className="w-full p-2 border rounded font-medium focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-slate-800"
                      />
                    </div>"""
new_qtext = """                    <div className="flex-1 mr-4">
                      {language !== 'en' && (
                        <div className="text-sm text-gray-500 dark:text-slate-400 mb-1 px-2 border-l-2 border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-2 rounded-r">
                          {q.question_text || "No English question text provided"}
                        </div>
                      )}
                      <input
                        type="text"
                        required={language === 'en'}
                        value={language === 'en' ? q.question_text : language === 'fr' ? (q.question_text_fr || '') : (q.question_text_zh || '')}
                        onChange={(e) => updateQuestion(q.id, language === 'en' ? 'question_text' : language === 'fr' ? 'question_text_fr' : 'question_text_zh', e.target.value)}
                        disabled={isLocked && language === 'en'}
                        placeholder={language === 'fr' ? "Traduction française" : language === 'zh' ? "中文翻译" : "Question Text"}
                        className="w-full p-2 border rounded font-medium focus:ring-2 focus:ring-[var(--color-cyc-primary)] focus:outline-none disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-slate-800"
                      />
                    </div>"""
content = content.replace(old_qtext, new_qtext)

# 13. RichTextEditor
old_rte = """                      {language === 'fr' && (
                        <div className="text-sm text-gray-500 dark:text-slate-400 mb-1 px-2 border-l-2 border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-2 rounded-r max-h-[100px] overflow-y-auto" dangerouslySetInnerHTML={{ __html: q.section_description || 'No English context provided' }} />
                      )}
                      <RichTextEditor
                        value={(language === 'en' ? q.section_description : q.section_description_fr) || ''}
                        onChange={(val) => updateQuestion(q.id, language === 'en' ? 'section_description' : 'section_description_fr', val)}
                        readOnly={isLocked && language === 'en'}
                        placeholder={language === 'en' ? "Provide context or instructions before the next set of questions..." : "Traduction française du contexte..."}
                      />"""
new_rte = """                      {language !== 'en' && (
                        <div className="text-sm text-gray-500 dark:text-slate-400 mb-1 px-2 border-l-2 border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-2 rounded-r max-h-[100px] overflow-y-auto" dangerouslySetInnerHTML={{ __html: q.section_description || 'No English context provided' }} />
                      )}
                      <RichTextEditor
                        value={(language === 'en' ? q.section_description : language === 'fr' ? q.section_description_fr : q.section_description_zh) || ''}
                        onChange={(val) => updateQuestion(q.id, language === 'en' ? 'section_description' : language === 'fr' ? 'section_description_fr' : 'section_description_zh', val)}
                        readOnly={isLocked && language === 'en'}
                        placeholder={language === 'en' ? "Provide context or instructions before the next set of questions..." : language === 'zh' ? "在此提供说明或背景信息..." : "Traduction française du contexte..."}
                      />"""
content = content.replace(old_rte, new_rte)

# 14. Definitions
old_def = """                        {language === 'fr' && (
                          <div className="col-span-2 text-sm text-gray-500 dark:text-slate-400 mb-1 px-2 border-l-2 border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-2 rounded-r">
                            <strong>Term:</strong> {engDef?.term || 'N/A'}<br/>
                            <strong>Def:</strong> {engDef?.definition || 'N/A'}
                          </div>
                        )}
                        <input
                          type="text"
                          value={def.term}
                          onChange={(e) => updateDefinition(q.id, dIdx, 'term', e.target.value)}
                          placeholder={language === 'fr' ? "Terme" : "Term"}
                          className="p-1.5 border rounded text-sm focus:ring-1 focus:ring-[var(--color-cyc-primary)] focus:outline-none w-full"
                        />
                        <input
                          type="text"
                          value={def.definition}
                          onChange={(e) => updateDefinition(q.id, dIdx, 'definition', e.target.value)}
                          placeholder={language === 'fr' ? "Définition" : "Definition"}
                          className="p-1.5 border rounded text-sm focus:ring-1 focus:ring-[var(--color-cyc-primary)] focus:outline-none w-full"
                        />"""
new_def = """                        {language !== 'en' && (
                          <div className="col-span-2 text-sm text-gray-500 dark:text-slate-400 mb-1 px-2 border-l-2 border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-2 rounded-r">
                            <strong>Term:</strong> {engDef?.term || 'N/A'}<br/>
                            <strong>Def:</strong> {engDef?.definition || 'N/A'}
                          </div>
                        )}
                        <input
                          type="text"
                          value={def.term}
                          onChange={(e) => updateDefinition(q.id, dIdx, 'term', e.target.value)}
                          placeholder={language === 'fr' ? "Terme" : language === 'zh' ? "术语" : "Term"}
                          className="p-1.5 border rounded text-sm focus:ring-1 focus:ring-[var(--color-cyc-primary)] focus:outline-none w-full"
                        />
                        <input
                          type="text"
                          value={def.definition}
                          onChange={(e) => updateDefinition(q.id, dIdx, 'definition', e.target.value)}
                          placeholder={language === 'fr' ? "Définition" : language === 'zh' ? "定义" : "Definition"}
                          className="p-1.5 border rounded text-sm focus:ring-1 focus:ring-[var(--color-cyc-primary)] focus:outline-none w-full"
                        />"""
content = content.replace(old_def, new_def)

# Fix any lingering `language === 'fr'` conditions that should be `language !== 'en'` for structural hidden stuff.
# Previously I replaced `language === 'fr' || isLocked ? 'hidden'`
content = re.sub(r"language === 'fr' \|\| isLocked \? 'hidden'", "language !== 'en' || isLocked ? 'hidden'", content)

with open("src/app/admin/edit/[id]/page.tsx", "w") as f:
    f.write(content)

print("edit/[id]/page.tsx updated.")
