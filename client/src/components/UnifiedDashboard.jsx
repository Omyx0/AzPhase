import React, { useState, useEffect } from "react";
import { 
  Clock, Sparkles, Brain, Loader2, BookOpen 
} from "lucide-react";
import { db, auth } from "../firebase"; 
import { collection, query, onSnapshot, where } from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai"; 
import FocusTimer from './FocusTimer'; 

// --- NEW IMPORTS (Ensure these files exist from previous steps) ---
import AcademicManager from './AcademicManager';
import ClassroomSync from './ClassroomSync';
import AIStudyAdvisor from './AIStudyAdvisor';
import LearningContinuityDashboard from './LearningContinuityDashboard';
import PeerCollaboration from './PeerCollaboration';
import SmartNotifications from './SmartNotifications';
import { detectFreeTime, getCurrentFreeTime } from '../utils/freeTimeDetector';
import { analyzeAcademicGaps, mapFreeTimeToGap } from '../utils/academicGapAnalyzer';

const UnifiedDashboard = ({ isDark }) => {
  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [metrics, setMetrics] = useState({ active: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [freeTimeSlots, setFreeTimeSlots] = useState([]);
  const [academicGaps, setAcademicGaps] = useState([]);
  const [currentFreeTime, setCurrentFreeTime] = useState(null);

  // New State for "Plan Now" Feature
  const [planningId, setPlanningId] = useState(null);
  const [aiPlans, setAiPlans] = useState({}); 

  // Fetch real data from 'timetable' collection
  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(collection(db, "timetable"), where("userId", "==", auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const classData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUpcomingClasses(classData);
      
      const cancelledCount = classData.filter(c => c.isCancelled).length;
      setMetrics({
        active: classData.length - cancelledCount,
        cancelled: cancelledCount
      });

      // Detect free time slots
      const freeSlots = detectFreeTime(classData);
      setFreeTimeSlots(freeSlots);
      
      // Get current free time
      const current = getCurrentFreeTime(classData);
      setCurrentFreeTime(current);
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch assignments for gap analysis
  useEffect(() => {
    if (!auth.currentUser) return;
    const assignmentsQuery = query(
      collection(db, "assignments"),
      where("userId", "==", auth.currentUser.uid)
    );
    const unsubscribe = onSnapshot(assignmentsQuery, async (snapshot) => {
      const assignmentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAssignments(assignmentData);

      // Analyze academic gaps
      const gaps = await analyzeAcademicGaps(null, assignmentData, upcomingClasses, []);
      setAcademicGaps(gaps);
    });
    return () => unsubscribe();
  }, [upcomingClasses]);

  // --- HANDLE "PLAN NOW" WITH GEMINI ---
  const handlePlanFreeTime = async (cls) => {
    setPlanningId(cls.id); 
    
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        alert("API Key missing! Check your .env file.");
        setPlanningId(null);
        return;
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      // Use valid stable models (gemini-pro is retired)
      // Updated based on API key availability - only 2.5 models work
      const modelCandidates = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

      const prompt = `My ${cls.subject} class at ${cls.time} was cancelled. I have a free hour. 
      Create a short, 1-sentence specific study task to revise this subject. 
      Keep it actionable (e.g., "Review Chapter 4 notes on...").`;

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
              const text = response.text();
              
              setAiPlans(prev => ({
                ...prev,
                [cls.id]: text || "Review your lecture notes and highlight key points."
              }));
              return; // Success, exit function
            } catch (retryError) {
              if (retryError.message?.includes('429') && retryCount < maxRetries) {
                // Wait before retry
                const retryDelay = 30000; // 30 seconds
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
      
      let errorMessage = "Failed to generate plan. Please try again later.";
      
      if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('Quota')) {
        errorMessage = "⏱️ Free tier quota exceeded (20 requests/day). Please wait 24 hours or upgrade at https://console.cloud.google.com/billing/overview";
      } else if (error.message?.includes('API key') || error.message?.includes('401') || error.message?.includes('403')) {
        errorMessage = "❌ API key error. Please check your VITE_GEMINI_API_KEY configuration.";
      }
      
      alert(errorMessage);
    } finally {
      setPlanningId(null);
    }
  };

  const theme = isDark ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900";
  const card = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";

  return (
    <div className={`min-h-screen p-6 ${theme}`}>
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className={`pb-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
          <div>
            <h1 className={`text-2xl font-bold ${textPrimary}`}>Student Dashboard</h1>
            <p className={`${textSecondary}`}>Manage your academics intelligently.</p>
          </div>
          <SmartNotifications isDark={isDark} />
        </header>

        {/* --- NEW: SMART STUDY HUB SECTION --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* Left Col: Classroom & Uploads */}
           <div className="lg:col-span-2 space-y-6">
              {/* 1. Google Classroom Sync */}
              <ClassroomSync isDark={isDark} />
              
              {/* 2. Permanent Document Uploads */}
              <div className={`p-6 rounded-xl border shadow-sm ${card}`}>
                 <div className="flex items-center gap-2 mb-6">
                    <BookOpen className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                    <h2 className={`text-lg font-bold ${textPrimary}`}>Academic Documents</h2>
                 </div>
                 <AcademicManager isDark={isDark} />
              </div>
           </div>

           {/* Right Col: Adaptive AI Advisor */}
           <div className="lg:col-span-1">
              <AIStudyAdvisor isDark={isDark} />
           </div>
        </div>

        {/* METRICS (Existing) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={`p-5 rounded-xl border shadow-sm transition-all hover:shadow-md ${card}`}>
            <p className={`text-3xl font-bold mb-1 ${textPrimary}`}>{upcomingClasses.length}</p>
            <span className={`text-sm ${textSecondary}`}>Total Classes</span>
          </div>
          <div className={`p-5 rounded-xl border shadow-sm transition-all hover:shadow-md ${card}`}>
            <p className={`text-3xl font-bold mb-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
              {metrics.active}
            </p>
            <span className={`text-sm ${textSecondary}`}>Active</span>
          </div>
          <div className={`p-5 rounded-xl border shadow-sm transition-all hover:shadow-md ${card}`}>
            <p className={`text-3xl font-bold mb-1 ${isDark ? 'text-red-400' : 'text-red-600'}`}>
              {metrics.cancelled}
            </p>
            <span className={`text-sm ${textSecondary}`}>Cancelled</span>
          </div>
        </div>

        {/* SCHEDULE LIST (Existing) */}
        <div>
          <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Your Schedule</h2>
          
          {loading ? (
            <div className={`text-center opacity-50 py-10 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Loading schedule...
            </div>
          ) : upcomingClasses.length === 0 ? (
            <div className={`text-center opacity-50 py-10 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              No classes found. Add classes in Timetable page.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {upcomingClasses.map((cls) => (
                <div key={cls.id} className={`p-5 rounded-xl border transition-all hover:shadow-md ${
                  cls.isCancelled ? (isDark ? 'border-red-500/40 bg-red-500/5' : 'border-red-300 bg-red-50/50') : card
                }`}>
                  
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className={`font-bold text-lg mb-1 ${isDark ? 'text-white' : 'text-gray-900'} ${
                        cls.isCancelled ? 'line-through opacity-60' : ''
                      }`}>
                        {cls.subject}
                      </h3>
                      <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        <Clock size={14} />
                        <span>{cls.time}</span>
                        <span>•</span>
                        <span>{cls.day}</span>
                        {cls.room && (
                          <>
                            <span>•</span>
                            <span>{cls.room}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {cls.isCancelled && (
                      <span className={`ml-3 text-xs font-bold px-2.5 py-1 rounded ${
                        isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
                      }`}>
                        CANCELLED
                      </span>
                    )}
                  </div>

                  {/* --- PLAN NOW SECTION (Existing) --- */}
                  {cls.isCancelled && (
                    <div className={`mt-4 p-3 rounded-lg border ${
                      isDark ? 'bg-red-900/10 border-red-500/20' : 'bg-red-50 border-red-100'
                    }`}>
                      
                      {aiPlans[cls.id] ? (
                        <div className="animate-in fade-in">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Sparkles className="w-4 h-4 text-indigo-500" />
                            <span className={`text-sm font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                              AI Plan:
                            </span>
                          </div>
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {aiPlans[cls.id]}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Brain className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                            <div className="text-sm">
                              <span className={`font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
                                Free Time!
                              </span>
                              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                Utilize this hour?
                              </p>
                            </div>
                          </div>
                          
                          <button 
                            onClick={() => handlePlanFreeTime(cls)}
                            disabled={planningId === cls.id}
                            className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {planningId === cls.id ? (
                              <Loader2 className="animate-spin" size={12} />
                            ) : (
                              <>
                                <Sparkles size={12} />
                                Plan Now
                              </>
                            )}
                          </button>
                        </div>
                      )}

                    </div>
                  )}

                </div>
              ))}
            </div>
          )}
        </div>

        {/* SMART FREE TIME DETECTION */}
        {freeTimeSlots.length > 0 && (
          <div className={`p-6 rounded-xl border ${card}`}>
            <div className="flex items-center gap-3 mb-4">
              <Brain className="w-6 h-6 text-indigo-500" />
              <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Smart Free-Time Detection
              </h2>
            </div>
            <div className="space-y-3">
              {freeTimeSlots.slice(0, 3).map((slot, idx) => {
                const mappedGap = mapFreeTimeToGap(slot, academicGaps);
                return (
                  <div key={idx} className={`p-4 rounded-lg border ${
                    isDark ? 'bg-indigo-900/20 border-indigo-700' : 'bg-indigo-50 border-indigo-200'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {slot.freeTimeDuration} min free ({slot.startTime} - {slot.endTime})
                        </p>
                        <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          📍 {slot.context.location} • 📚 Workload: {slot.context.dayWorkloadLevel}
                        </p>
                        {slot.context.previousSubject && slot.context.nextSubject && (
                          <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            Between: {slot.context.previousSubject} → {slot.context.nextSubject}
                          </p>
                        )}
                      </div>
                      <span className={`ml-3 text-xs px-2 py-1 rounded whitespace-nowrap ${
                        slot.type === 'cancelled' 
                          ? isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
                          : isDark ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {slot.type === 'cancelled' ? 'Cancelled' : 'Gap'}
                      </span>
                    </div>
                    {mappedGap && (
                      <div className={`mt-3 p-3 rounded-lg ${isDark ? 'bg-yellow-900/20 border border-yellow-700/50' : 'bg-yellow-50 border border-yellow-200'}`}>
                        <p className={`text-sm font-medium ${isDark ? 'text-yellow-300' : 'text-yellow-800'}`}>
                          📚 Recommended: {mappedGap.insight}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* FOCUS TIMER SECTION (Existing) */}
        <div className="mt-8 p-1 rounded-xl" style={{
          background: 'linear-gradient(to right, #4f46e5, #9333ea)',
          padding: '2px' 
        }}>
           <div className={`rounded-xl overflow-hidden ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
              <FocusTimer isDark={isDark} />
           </div>
        </div>

      </div>
    </div>
  );
};

export default UnifiedDashboard;