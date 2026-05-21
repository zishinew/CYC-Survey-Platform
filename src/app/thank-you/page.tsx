"use client";
import { CheckCircle2, Clock, Users, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

interface Survey {
  id: string;
  title: string;
  description: string;
  estimated_minutes: number;
  thumbnail_url?: string;
  response_count?: number;
}

export default function ThankYouPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/surveys?include_inactive=false')
      .then(res => res.json())
      .then((data: Survey[]) => {
        // Filter out the survey they just completed if we can (though we don't know the ID here easily without URL params, so we'll just show all active ones for now)
        setSurveys(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-50 pb-20">
      <div className="w-full bg-[var(--color-cyc-primary)] pt-16 pb-32 px-4 text-center">
        <div className="mx-auto flex justify-center items-center w-24 h-24 bg-white rounded-full shadow-lg mb-6">
          <CheckCircle2 className="w-14 h-14 text-[var(--color-cyc-primary)]" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4">
          Thank You!
        </h1>
        <p className="text-lg md:text-xl text-teal-50 max-w-2xl mx-auto leading-relaxed">
          Your responses have been successfully submitted. We greatly appreciate you taking the time to share your voice and help empower Canadian youth.
        </p>
      </div>

      <div className="w-full max-w-6xl mx-auto px-4 -mt-16">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-[var(--color-cyc-secondary)] mb-6">Keep Your Voice Heard</h2>
          <p className="text-gray-600 mb-8">If you have a few more minutes, consider taking another active survey to further contribute to our research.</p>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-cyc-primary)]"></div>
            </div>
          ) : surveys.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {surveys.map((survey, i) => (
                <motion.div key={survey.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                  <Link href={`/survey/${survey.id}`} className="block h-full group">
                    <div className="border border-gray-200 rounded-xl overflow-hidden h-full flex flex-col hover:border-[var(--color-cyc-primary)] hover:shadow-lg transition-all duration-300 bg-white">
                      {survey.thumbnail_url ? (
                        <div className="h-40 w-full overflow-hidden">
                          <img src={survey.thumbnail_url} alt={survey.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        </div>
                      ) : (
                        <div className="h-40 w-full bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center border-b border-gray-100 relative overflow-hidden">
                          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[var(--color-cyc-primary)] to-transparent"></div>
                          <span className="text-5xl font-black text-white drop-shadow-md opacity-50 select-none">CYC</span>
                        </div>
                      )}
                      <div className="p-5 flex flex-col flex-grow">
                        <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-[var(--color-cyc-primary)] transition-colors line-clamp-2">
                          {survey.title}
                        </h3>
                        <p className="text-gray-500 text-sm mb-4 line-clamp-2 flex-grow">
                          {survey.description || 'Participate in this survey to share your perspectives.'}
                        </p>
                        <div className="flex items-center justify-between text-xs font-semibold text-gray-500 mt-auto pt-4 border-t border-gray-100">
                          <span className="flex items-center text-[var(--color-cyc-primary)] bg-teal-50 px-2 py-1 rounded-md">
                            <Clock className="w-3.5 h-3.5 mr-1" />
                            {survey.estimated_minutes} min
                          </span>
                          <span className="flex items-center text-blue-600 bg-blue-50 px-2 py-1 rounded-md group-hover:bg-[var(--color-cyc-primary)] group-hover:text-white transition-colors">
                            Take Survey <ArrowRight className="w-3 h-3 ml-1" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <p className="text-gray-500 font-medium">There are no other active surveys at the moment. Please check back later!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
