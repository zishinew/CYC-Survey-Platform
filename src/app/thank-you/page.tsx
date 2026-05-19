"use client";
import { CheckCircle2 } from "lucide-react";

export default function ThankYouPage() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 w-full h-full text-center py-20">
      <div className="bg-white p-8 md:p-12 rounded-2xl shadow-xl border-t-4 border-t-[var(--color-cyc-primary)] max-w-2xl w-full">
        <div className="mx-auto flex justify-center items-center w-20 h-20 bg-teal-50 rounded-full mb-6">
          <CheckCircle2 className="w-12 h-12 text-[var(--color-cyc-primary)]" />
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--color-cyc-secondary)] mb-4">
          Thank You!
        </h1>
        <p className="text-lg text-gray-600 mb-8 leading-relaxed">
          Your responses have been successfully submitted. We greatly appreciate you taking the time to share your voice and help empower Canadian youth.
        </p>
      </div>
    </div>
  );
}