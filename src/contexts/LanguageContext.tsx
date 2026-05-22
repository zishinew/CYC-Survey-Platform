"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'fr';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    'Admin': 'Admin',
    'Start Survey': 'Start Survey',
    'Estimated time:': 'Estimated time:',
    'minutes': 'minutes',
    'Active Surveys': 'Active Surveys',
    'Share your voice and help empower Canadian youth.': 'Share your voice and help empower Canadian youth.',
    'Share your perspective on issues that matter.': 'Share your perspective on issues that matter.',
    'Coming Soon': 'Coming Soon',
    'Completed': 'Completed',
    'Done': 'Done',
    'Almost Done!': 'Almost Done!',
    'What is your email address?': 'What is your email address?',
    'Before we begin': 'Before we begin',
    'Information': 'Information',
    'Question': 'Question',
    'of': 'of',
    'Submit': 'Submit',
    'Next': 'Next',
    'Back': 'Back',
    'Submitting...': 'Submitting...',
    'Finish Survey': 'Finish Survey',
    'Continue': 'Continue',
    'A valid email address is required to enter the raffle and to contact participants when the second and third questionnaires are released.': 'A valid email address is required to enter the raffle and to contact participants when the second and third questionnaires are released.',
    'Email addresses will remain confidential and will not be shared publicly or used for purposes unrelated to the survey series or raffle administration.': 'Email addresses will remain confidential and will not be shared publicly or used for purposes unrelated to the survey series or raffle administration.',
    'More Surveys Coming Soon': 'More Surveys Coming Soon',
    'We are preparing new surveys to gather your feedback. Please check back later to share your perspective!': 'We are preparing new surveys to gather your feedback. Please check back later to share your perspective!',
    'START NOW': 'START NOW',
    'MIN': 'MIN',
    'Make Your Voice': 'Make Your Voice',
    'Heard.': 'Heard.',
    '1 Survey = 1 Entry': '1 Survey = 1 Entry',
    'Win $100 (5 Winners!)': 'Win $100 (5 Winners!)',
    'Other:': 'Other:',
    'Type your answer': 'Type your answer',
    'Survey not found or unavailable.': 'Survey not found or unavailable.',
    'Already Completed': 'Already Completed',
    'You have already submitted your response for': 'You have already submitted your response for',
    'Thank you for participating!': 'Thank you for participating!',
    'Please enter a valid email address.': 'Please enter a valid email address.',
    'This question is required. Please provide an answer.': 'This question is required. Please provide an answer.',
    'Failed to submit response': 'Failed to submit response',
    'Failed to submit survey. Please try again.': 'Failed to submit survey. Please try again.',
    'Select an option...': 'Select an option...',
    'Enter a number:': 'Enter a number:',
    'e.g. 100': 'e.g. 100',
    'Select up to': 'Select up to',
    'options': 'options',
    'Strongly Disagree': 'Strongly Disagree',
    'Neutral': 'Neutral',
    'Strongly Agree': 'Strongly Agree',
    'Share your thoughts here...': 'Share your thoughts here...',
    'Thank You!': 'Thank You!',
    'Your responses have been successfully submitted. We greatly appreciate you taking the time to share your voice and help empower Canadian youth.': 'Your responses have been successfully submitted. We greatly appreciate you taking the time to share your voice and help empower Canadian youth.',
    'Keep Your Voice Heard': 'Keep Your Voice Heard',
    'If you have a few more minutes, consider contributing to another active survey.': 'If you have a few more minutes, consider contributing to another active survey.',
    'Participate in this survey to share your perspectives.': 'Participate in this survey to share your perspectives.',
    'Take Survey': 'Take Survey',
    'There are no other active surveys at the moment. Please check back later!': 'There are no other active surveys at the moment. Please check back later!',
    'Are you still there? Please select "Yes" to continue.': 'Are you still there? Please select "Yes" to continue.',
    'No': 'No',
    'Yes': 'Yes',
    'Maybe': 'Maybe',
    'True': 'True',
    'False': 'False',
    'out of': 'out of',
  },
  fr: {
    'Admin': 'Administrateur',
    'Start Survey': 'Commencer le sondage',
    'Estimated time:': 'Temps estime :',
    'minutes': 'minutes',
    'Active Surveys': 'Sondages en cours',
    'Share your voice and help empower Canadian youth.': 'Faites entendre votre voix et contribuez a l\'autonomisation des jeunes Canadiens.',
    'Share your perspective on issues that matter.': 'Partagez votre point de vue sur les enjeux importants.',
    'Coming Soon': 'Bientôt disponible',
    'Completed': 'Terminé',
    'Done': 'Fait',
    'Almost Done!': 'Presque Terminé !',
    'What is your email address?': 'Quelle est votre adresse courriel ?',
    'Before we begin': 'Avant de commencer',
    'Information': 'Informations',
    'Question': 'Question',
    'of': 'sur',
    'Submit': 'Soumettre',
    'Next': 'Suivant',
    'Back': 'Retour',
    'Submitting...': 'Soumission...',
    'Finish Survey': 'Terminer le sondage',
    'Continue': 'Continuer',
    'A valid email address is required to enter the raffle and to contact participants when the second and third questionnaires are released.': 'Une adresse courriel valide est requise pour participer au tirage au sort ainsi que pour communiquer avec les participants lors de la publication des deuxième et troisième questionnaires.',
    'Email addresses will remain confidential and will not be shared publicly or used for purposes unrelated to the survey series or raffle administration.': 'Les adresses courriel demeureront confidentielles. Elles ne seront ni divulguées publiquement ni utilisées à des fins autres que celles liées à la série de sondages ou à l’administration du tirage au sort.',
    'More Surveys Coming Soon': 'Plus de sondages à venir bientôt',
    'We are preparing new surveys to gather your feedback. Please check back later to share your perspective!': 'Nous préparons de nouveaux sondages pour recueillir vos commentaires. Veuillez revenir plus tard pour partager votre point de vue !',
    'START NOW': 'COMMENCER',
    'MIN': 'MIN',
    'Make Your Voice': 'Faites entendre',
    'Heard.': 'votre voix.',
    '1 Survey = 1 Entry': '1 Sondage = 1 Participation',
    'Win $100 (5 Winners!)': 'Gagnez 100$ (5 Gagnants!)',
    'Other:': 'Autre:',
    'Type your answer': 'Tapez votre réponse',
    'Survey not found or unavailable.': 'Sondage introuvable ou indisponible.',
    'Already Completed': 'Déjà terminé',
    'You have already submitted your response for': 'Vous avez déjà soumis votre réponse pour',
    'Thank you for participating!': 'Merci d\'avoir participé !',
    'Please enter a valid email address.': 'Veuillez entrer une adresse courriel valide.',
    'This question is required. Please provide an answer.': 'Cette question est obligatoire. Veuillez fournir une réponse.',
    'Failed to submit response': 'Échec de l\'envoi de la réponse.',
    'Failed to submit survey. Please try again.': 'Échec de l\'envoi du sondage. Veuillez réessayer.',
    'Select an option...': 'Sélectionnez une option...',
    'Enter a number:': 'Entrez un nombre :',
    'e.g. 100': 'ex. 100',
    'Select up to': 'Sélectionnez jusqu\'à',
    'options': 'options',
    'Strongly Disagree': 'Tout à fait en désaccord',
    'Neutral': 'Neutre',
    'Strongly Agree': 'Tout à fait d\'accord',
    'Share your thoughts here...': 'Partagez vos idées ici...',
    'Thank You!': 'Merci !',
    'Your responses have been successfully submitted. We greatly appreciate you taking the time to share your voice and help empower Canadian youth.': 'Vos réponses ont bien été soumises. Nous vous remercions sincèrement d\'avoir pris le temps de partager votre voix et de contribuer à l\'autonomisation des jeunes Canadiens.',
    'Keep Your Voice Heard': 'Faites entendre votre voix',
    'If you have a few more minutes, consider contributing to another active survey.': 'Si vous avez quelques minutes de plus, pensez à répondre à un autre sondage actif.',
    'Participate in this survey to share your perspectives.': 'Participez à ce sondage pour partager votre point de vue.',
    'Take Survey': 'Faire le sondage',
    'There are no other active surveys at the moment. Please check back later!': 'Il n\'y a aucun autre sondage actif pour le moment. Veuillez revenir plus tard !',
    'Are you still there? Please select "Yes" to continue.': 'Êtes-vous toujours là ? Veuillez sélectionner "Oui" pour continuer.',
    'No': 'Non',
    'Yes': 'Oui',
    'Maybe': 'Peut-être',
    'True': 'Vrai',
    'False': 'Faux',
    'out of': 'sur',
  }
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
});

export const LanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const [language, setLanguage] = useState<Language>('en');
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('cyc_language') as Language;
    if (saved === 'fr' || saved === 'en') {
      setLanguage(saved);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    if (lang === language) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setLanguage(lang);
      localStorage.setItem('cyc_language', lang);
      
      // Allow react to commit the new language text, then fade back in
      setTimeout(() => {
        setIsTransitioning(false);
      }, 50);
    }, 200);
  };

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      <div className={`flex-1 flex flex-col w-full transition-opacity duration-300 ease-in-out ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
