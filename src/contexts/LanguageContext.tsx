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
  },
  fr: {
    'Admin': 'Administrateur',
    'Start Survey': 'Commencer le sondage',
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
    'A valid email address is required to enter the raffle and to contact participants when the second and third questionnaires are released.': 'Une adresse courriel valide est requise pour participer au tirage au sort et pour contacter les participants lorsque les deuxième et troisième questionnaires seront publiés.',
    'Email addresses will remain confidential and will not be shared publicly or used for purposes unrelated to the survey series or raffle administration.': 'Les adresses courriel resteront confidentielles et ne seront pas partagées publiquement ni utilisées à des fins non liées à la série de sondages ou à l\'administration du tirage au sort.',
    'More Surveys Coming Soon': 'Plus de sondages à venir bientôt',
    'We are preparing new surveys to gather your feedback. Please check back later to share your perspective!': 'Nous préparons de nouveaux sondages pour recueillir vos commentaires. Veuillez revenir plus tard pour partager votre point de vue !',
    'START NOW': 'COMMENCER',
    'MIN': 'MIN',
    'Make Your Voice': 'Faites entendre',
    'Heard.': 'votre voix.',
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
