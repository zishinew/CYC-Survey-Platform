import re

with open("src/contexts/LanguageContext.tsx", "r") as f:
    content = f.read()

# 1. Update Language type
content = content.replace(
    "type Language = 'en' | 'fr';",
    "type Language = 'en' | 'fr' | 'zh';"
)

# 2. Add zh translations
zh_dict = """  zh: {
    'Admin': '管理',
    'Start Survey': '开始调查',
    'Estimated time:': '预计时间:',
    'minutes': '分钟',
    'Active Surveys': '进行中的调查',
    'Share your voice and help empower Canadian youth.': '分享您的声音，助力赋能加拿大青年。',
    'Share your perspective on issues that matter.': '分享您对重要问题的看法。',
    'Coming Soon': '即将推出',
    'Completed': '已完成',
    'Done': '完成',
    'Almost Done!': '快完成了！',
    'What is your email address?': '您的电子邮箱地址是什么？',
    'Before we begin': '开始之前',
    'Information': '信息',
    'Question': '问题',
    'of': '/',
    'Submit': '提交',
    'Next': '下一步',
    'Back': '返回',
    'Submitting...': '提交中...',
    'Finish Survey': '完成调查',
    'Continue': '继续',
    'A valid email address is required to enter the raffle and to contact participants when the second and third questionnaires are released.': '需要有效的电子邮件地址才能参加抽奖，并在发布第二和第三份问卷时联系参与者。',
    'Email addresses will remain confidential and will not be shared publicly or used for purposes unrelated to the survey series or raffle administration.': '电子邮件地址将保密，不会公开发布，也不会用于与系列调查或抽奖管理无关的用途。',
    'More Surveys Coming Soon': '更多调查即将推出',
    'We are preparing new surveys to gather your feedback. Please check back later to share your perspective!': '我们正在准备新的调查以收集您的反馈。请稍后再来分享您的观点！',
    'START NOW': '现在开始',
    'MIN': '分钟',
    'Make Your Voice': '让您的声音',
    'Heard.': '被听到。',
    '1 Survey = 1 Entry': '1次调查 = 1次抽奖机会',
    'Win $100 (5 Winners!)': '赢取$100 (5名获奖者！)',
    'Other:': '其他:',
    'Type your answer': '输入您的回答',
    'Survey not found or unavailable.': '调查未找到或不可用。',
    'Already Completed': '已完成',
    'You have already submitted your response for': '您已经提交了对以下调查的答复：',
    'Thank you for participating!': '感谢您的参与！',
    'Please enter a valid email address.': '请输入有效的电子邮件地址。',
    'This question is required. Please provide an answer.': '此问题为必填项。请提供答案。',
    'Failed to submit response': '提交回复失败',
    'Failed to submit survey. Please try again.': '提交调查失败。请重试。',
    'Select an option...': '选择一个选项...',
    'Enter a number:': '输入数字:',
    'e.g. 100': '例如 100',
    'Select up to': '最多选择',
    'options': '项',
    'Strongly Disagree': '强烈反对',
    'Neutral': '中立',
    'Strongly Agree': '强烈同意',
    'Share your thoughts here...': '在这里分享您的想法...',
    'Thank You!': '谢谢！',
    'Your responses have been successfully submitted. We greatly appreciate you taking the time to share your voice and help empower Canadian youth.': '您的回复已成功提交。我们非常感谢您抽出宝贵时间分享您的声音，助力赋能加拿大青年。',
    'Keep Your Voice Heard': '继续发声',
    'If you have a few more minutes, consider contributing to another active survey.': '如果您还有几分钟时间，请考虑参与其他进行中的调查。',
    'Participate in this survey to share your perspectives.': '参与此调查，分享您的观点。',
    'Take Survey': '参与调查',
    'There are no other active surveys at the moment. Please check back later!': '目前没有其他进行中的调查。请稍后再来！',
    'Are you still there? Please select "Yes" to continue.': '您还在吗？请选择“是”以继续。',
    'No': '否',
    'Yes': '是',
    'Maybe': '也许',
    'True': '正确',
    'False': '错误',
    'out of': '/',
  }
};"""
content = content.replace("  }\n};", "  },\n" + zh_dict)

# 3. Update useEffect loading saved language to support 'zh'
content = content.replace(
    "if (saved === 'fr' || saved === 'en') {",
    "if (saved === 'fr' || saved === 'en' || saved === 'zh') {"
)

with open("src/contexts/LanguageContext.tsx", "w") as f:
    f.write(content)

print("contexts/LanguageContext.tsx updated.")
