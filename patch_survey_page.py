import re

with open("src/app/survey/[id]/page.tsx", "r") as f:
    content = f.read()

# 1. Update fetch catch to include questions_zh (mostly cosmetic)
content = content.replace(
    "fetch(`/api/surveys/${params.id}/translation`).then(r => r.json()).catch(() => ({ questions_fr: null }))",
    "fetch(`/api/surveys/${params.id}/translation`).then(r => r.json()).catch(() => ({ questions_fr: null, questions_zh: null }))"
)

# 2. Add properties to survey object
old_survey_assign = """        if (translationData?.description_fr) {
          data.description_fr = translationData.description_fr;
        }"""
new_survey_assign = """        if (translationData?.description_fr) {
          data.description_fr = translationData.description_fr;
        }
        if (translationData?.questions_zh) {
          data.questions_zh = translationData.questions_zh;
        }
        if (translationData?.title_zh) {
          data.title_zh = translationData.title_zh;
        }
        if (translationData?.description_zh) {
          data.description_zh = translationData.description_zh;
        }"""
content = content.replace(old_survey_assign, new_survey_assign)

# 3. Update useMemo
old_usememo = """    if (language === 'fr' && survey?.questions_fr) {
      const frQ = survey.questions_fr.find((q: any) => q.id === finalQ.id);
      if (frQ) {
        finalQ.question_text = frQ.question_text;
        finalQ.options = frQ.options;
      }
    }
    
    // Manually translate injected attention checks
    if (language === 'fr' && finalQ.id.startsWith('attn-')) {"""
new_usememo = """    if (language === 'fr' && survey?.questions_fr) {
      const frQ = survey.questions_fr.find((q: any) => q.id === finalQ.id);
      if (frQ) {
        finalQ.question_text = frQ.question_text;
        finalQ.options = frQ.options;
      }
    } else if (language === 'zh' && survey?.questions_zh) {
      const zhQ = survey.questions_zh.find((q: any) => q.id === finalQ.id);
      if (zhQ) {
        finalQ.question_text = zhQ.question_text;
        finalQ.options = zhQ.options;
      }
    }
    
    // Manually translate injected attention checks
    if (language === 'fr' && finalQ.id.startsWith('attn-')) {"""
content = content.replace(old_usememo, new_usememo)

old_attn = """      } else if (finalQ.id === 'attn-inact-1') {
        finalQ.question_text = 'Êtes-vous toujours là ? Veuillez sélectionner "Oui" pour continuer.';
        finalQ.options = { choices: ["Non", "Oui", "Peut-être"] };
      }
    }
    return finalQ;"""
new_attn = """      } else if (finalQ.id === 'attn-inact-1') {
        finalQ.question_text = 'Êtes-vous toujours là ? Veuillez sélectionner "Oui" pour continuer.';
        finalQ.options = { choices: ["Non", "Oui", "Peut-être"] };
      }
    } else if (language === 'zh' && finalQ.id.startsWith('attn-')) {
      if (finalQ.id === 'attn-fixed-1') {
        finalQ.question_text = '<span class="text-sm md:text-base font-normal text-gray-500 dark:text-slate-400 block mb-4">在回答有关住房和经济政策的问题时，仔细阅读每项声明非常重要。为了表明您正在集中注意力，请在此特定问题中选择“4（同意）”选项。</span>您对当前联邦基础设施项目时间表的同意或不同意程度如何？';
      } else if (finalQ.id === 'attn-fixed-2') {
        finalQ.question_text = '<span class="text-sm md:text-base font-normal text-gray-500 dark:text-slate-400 block mb-4">为确保我们的数据质量标准得到满足，请回答以下简单的声明：</span>“加拿大政府已正式解散该国货币并禁止所有商品和服务的交换。”';
        finalQ.options = { choices: ["正确", "错误"] };
      } else if (finalQ.id === 'attn-inact-1') {
        finalQ.question_text = '您还在吗？请选择“是”以继续。';
        finalQ.options = { choices: ["否", "是", "也许"] };
      }
    }
    return finalQ;"""
content = content.replace(old_attn, new_attn)

# 4. displayTitle and displayDescription
old_display = """  const displayTitle = language === 'fr' && survey?.title_fr ? survey.title_fr : survey?.title;
  const displayDescription = language === 'fr' && survey?.description_fr ? survey.description_fr : survey?.description;"""
new_display = """  const displayTitle = language === 'fr' && survey?.title_fr ? survey.title_fr : language === 'zh' && survey?.title_zh ? survey.title_zh : survey?.title;
  const displayDescription = language === 'fr' && survey?.description_fr ? survey.description_fr : language === 'zh' && survey?.description_zh ? survey.description_zh : survey?.description;"""
content = content.replace(old_display, new_display)

with open("src/app/survey/[id]/page.tsx", "w") as f:
    f.write(content)

print("survey/[id]/page.tsx updated.")
