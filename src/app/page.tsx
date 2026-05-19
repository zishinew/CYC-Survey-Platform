"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Clock } from 'lucide-react';

export default function Home() {
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  useEffect(() => {
    const completed = JSON.parse(localStorage.getItem('cyc_completed_surveys') || '[]');
    setCompletedIds(completed);

    fetch('/api/surveys')
      .then(res => res.json())
      .then(data => {
        setSurveys(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-cyc-primary)]"></div>
      </div>
    );
  }

  if (surveys.length === 0) {
    return (
      <div className="flex-1 flex justify-center items-center text-center p-4">
        <h1 className="text-2xl font-bold text-gray-500">Currently, there are no active surveys.</h1>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--color-cyc-secondary)] mb-3">
          Active Surveys
        </h1>
        <p className="text-gray-500 text-lg">
          Share your voice and help empower Canadian youth.
        </p>
      </motion.div>

      <div className="grid gap-6 sm:grid-cols-2">
        {surveys.map((survey, idx) => {
          const isCompleted = completedIds.includes(survey.id);
          return (
            <motion.div
              key={survey.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: idx * 0.1 }}
            >
              <div className={`relative bg-white rounded-2xl shadow-md border overflow-hidden transition-all duration-300 ${isCompleted ? 'border-green-200 opacity-80' : 'border-gray-200 hover:shadow-xl hover:-translate-y-1'}`}>
                {/* Thumbnail */}
                {survey.thumbnail_url ? (
                  <div className="w-full h-36 overflow-hidden">
                    <img src={survey.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className={`h-1.5 w-full ${isCompleted ? 'bg-green-400' : 'bg-[var(--color-cyc-accent)]'}`} />
                )}

                <div className="p-6">
                  {/* Completed badge */}
                  {isCompleted && (
                    <div className="flex items-center text-green-600 text-xs font-bold mb-3 bg-green-50 px-3 py-1.5 rounded-full w-fit">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      Completed
                    </div>
                  )}

                  <h2 className="text-xl font-bold text-[var(--color-cyc-secondary)] mb-2 leading-snug">
                    {survey.title}
                  </h2>
                  <p className="text-sm text-gray-500 mb-5 line-clamp-2 leading-relaxed">
                    {survey.description || 'Share your thoughts on this survey.'}
                  </p>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center text-xs text-gray-400 font-medium">
                      <Clock className="w-3.5 h-3.5 mr-1" />
                      {survey.estimated_minutes} min
                    </span>

                    {isCompleted ? (
                      <span className="text-sm text-gray-400 font-semibold">
                        Thank you!
                      </span>
                    ) : (
                      <Link
                        href={`/survey/${survey.id}`}
                        className="btn-primary flex items-center px-5 py-2 rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all"
                      >
                        Start Survey
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
