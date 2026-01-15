import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { db, auth } from '../firebase';
import { doc, getDoc } from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";

const AIStudyAdvisor = ({ isDark }) => {
  const [advice, setAdvice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [academicData, setAcademicData] = useState(null);

  // 1. Load Permanent Docs from Profile
  useEffect(() => {
    const loadData = async () => {
      if (!auth.currentUser) return;
      try {
        const docRef = doc(db, "users", auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().academicData) {
          setAcademicData(docSnap.data().academicData);
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      }
    };
    loadData();
  }, []);

  // 2. The Adaptive Logic
  const generateAdaptivePlan = async () => {
    setLoading(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        setAdvice("API Key missing. Check .env file.");
        setLoading(false);
        return;
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Try models with fallback for quota issues
      const modelCandidates = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

      // Construct Context based on what they uploaded
      let context = "You are an expert academic advisor for a Computer Science student.";
      let hasDocs = false;
      
      if (academicData?.syllabusUrl) {
        context += ` The student has uploaded a syllabus (URL: ${academicData.syllabusUrl}). Assume standard CS syllabus structure.`;
        hasDocs = true;
      }
      if (academicData?.schemeUrl) {
        context += ` The marking scheme (URL: ${academicData.schemeUrl}) prioritizes high-weightage units.`;
        hasDocs = true;
      }
      
      if (!hasDocs) {
        context += " The student has not uploaded specific documents yet, so provide general high-yield advice.";
      }

      // The Adaptive Prompt
      const prompt = `${context}
      The student has a free slot right now. 
      Based on the provided documents (or general CS principles if missing),
      suggest ONE high-impact study topic to focus on for the next 45 minutes.
      Explain WHY this topic is chosen (e.g., "It usually carries 10 marks" or "Fundamental concept").
      Keep it short, actionable, and motivating.`;

      // Try each model with retry logic for 429 errors
      let lastError;
      for (const modelName of modelCandidates) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          
          // Retry logic for rate limiting (429 errors)
          let retryCount = 0;
          const maxRetries = 2;
          while (retryCount <= maxRetries) {
            try {
              const result = await model.generateContent(prompt);
              const response = await result.response;
              setAdvice(response.text());
              return; // Success, exit function
            } catch (retryError) {
              if (retryError.message?.includes('429') && retryCount < maxRetries) {
                // Extract retry delay from error or use exponential backoff
                const retryDelay = 30000; // 30 seconds
                setAdvice(`⏳ Rate limit reached. Retrying in ${retryDelay/1000}s...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                retryCount++;
              } else {
                throw retryError; // Re-throw if not 429 or max retries reached
              }
            }
          }
        } catch (error) {
          lastError = error;
          // If quota exceeded, try next model
          if (error.message?.includes('429') && modelCandidates.indexOf(modelName) < modelCandidates.length - 1) {
            continue; // Try next model
          }
          throw error; // Re-throw if last model or not quota error
        }
      }
      
      // If we get here, all models failed
      throw lastError || new Error("All models failed");

    } catch (error) {
      console.error("AI Error:", error);
      
      let errorMessage = "Could not generate advice. Please try again later.";
      
      if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('Quota')) {
        errorMessage = "⏱️ Free tier quota exceeded (20 requests/day). Please wait 24 hours or upgrade to a paid plan at https://console.cloud.google.com/billing/overview";
      } else if (error.message?.includes('API key') || error.message?.includes('401') || error.message?.includes('403')) {
        errorMessage = "❌ API key error. Please check your VITE_GEMINI_API_KEY configuration.";
      }
      
      setAdvice(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const theme = {
    card: isDark ? "bg-indigo-900/20 border-indigo-500/30" : "bg-indigo-50 border-indigo-200",
    text: isDark ? "text-white" : "text-gray-900",
    subText: isDark ? "text-indigo-200" : "text-indigo-600",
  };

  return (
    <div className={`p-6 rounded-xl border h-full flex flex-col ${theme.card}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-500/30">
          <Brain className="w-6 h-6" />
        </div>
        <div>
          <h2 className={`text-lg font-bold ${theme.text}`}>Adaptive Advisor</h2>
          <p className={`text-xs opacity-70 ${theme.text}`}>Based on your Syllabus & Scheme</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center min-h-[120px]">
        {advice ? (
          <div className="animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-start gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
              <p className={`text-sm leading-relaxed ${theme.text}`}>{advice}</p>
            </div>
            <button 
              onClick={generateAdaptivePlan} 
              className="mt-auto text-xs font-bold text-indigo-500 hover:underline flex items-center gap-1 transition-all"
            >
              <RefreshCw className="w-3 h-3" /> Regenerate
            </button>
          </div>
        ) : (
          <div className="text-center py-2">
            {!academicData?.syllabusUrl && !academicData?.schemeUrl && (
              <div className="flex items-center justify-center gap-2 text-xs text-amber-500 mb-3 bg-amber-500/10 py-1 px-2 rounded-full w-fit mx-auto">
                <AlertCircle className="w-3 h-3" /> Upload Docs for better results
              </div>
            )}
            
            <p className={`text-sm opacity-80 mb-4 ${theme.text}`}>
              {academicData ? "Ready to analyze your academic profile." : "I can help plan your next study session."}
            </p>
            
            <button 
              onClick={generateAdaptivePlan}
              disabled={loading}
              className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
            >
              {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              Generate Smart Plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIStudyAdvisor;