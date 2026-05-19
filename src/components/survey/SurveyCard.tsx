import Link from 'next/link';
import { Clock, ArrowRight } from 'lucide-react';

interface SurveyCardProps {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
}

export function SurveyCard({ id, title, description, estimatedMinutes }: SurveyCardProps) {
  return (
    <div className="card flex flex-col h-full group">
      <div className="flex-grow">
        <h3 className="text-xl font-bold mb-2 text-[var(--color-cyc-secondary)] group-hover:text-[var(--color-cyc-primary)] transition-colors">
          {title}
        </h3>
        <p className="text-gray-600 mb-4 line-clamp-3">
          {description}
        </p>
      </div>
      
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-[var(--color-cyc-divider)]">
        <div className="flex items-center text-sm text-gray-500">
          <Clock className="w-4 h-4 mr-1" />
          <span>~{estimatedMinutes} min</span>
        </div>
        
        <Link 
          href={`/survey/${id}`}
          className="inline-flex items-center btn-primary text-sm py-1.5 px-3"
        >
          Start Survey
          <ArrowRight className="w-4 h-4 ml-1" />
        </Link>
      </div>
    </div>
  );
}
