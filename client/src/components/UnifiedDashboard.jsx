import React, { useState, useEffect } from "react";
import { 
  Clock, AlertTriangle, CheckCircle, 
  Brain, Calendar, ArrowRight, Loader2, Sparkles 
} from "lucide-react";
import { db, auth } from "../firebase"; // Ensure this path is correct based on your folder structure
import { collection, query, onSnapshot } from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai"; // Import Gemini SDK
import FocusTimer from './FocusTimer'; // Check if this file is in the same folder or use '../components/FocusTimer'

const UnifiedDashboard = ({ isDark }) => {
  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [metrics, setMetrics] = useState({ active: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);

  // New State for "Plan Now" Feature
  const [planningId, setPlanningId] = useState(null);
  const [aiPlans, setAiPlans] = useState({}); 

  // Fetch real data from 'timetable' collection
  useEffect(() => {
    if (!auth.currentUser) return;
    
    // Note: If you want specific user data, use where("userId", "==", auth.currentUser.uid)
    const q = query(collection(db, "timetable"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const classData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUpcomingClasses(classData);
      
      const cancelledCount = classData.filter(c => c.isCancelled).length;
      setMetrics({
        active: classData.length - cancelledCount,
        cancelled: cancelledCount
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- UPDATED: HANDLE "PLAN NOW" WITH GEMINI DIRECTLY ---
  const handlePlanFreeTime = async (cls) => {
    setPlanningId(cls.id); 
    
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        alert("API Key missing! Check your .env file.");
        setPlanningId(null);
        return;
      }

      // 1. Initialize Gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      // 2. Create Prompt
      const prompt = `My ${cls.subject} class at ${cls.time} was cancelled. I have a free hour. 
      Create a short, 1-sentence specific study task to revise this subject. 
      Keep it actionable (e.g., "Review Chapter 4 notes on...").`;

      // 3. Generate Content
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      setAiPlans(prev => ({
        ...prev,
        [cls.id]: text || "Review your lecture notes and highlight key points."
      }));

    } catch (error) {
      console.error("AI Error:", error);
      alert("Failed to generate plan. Check console for details.");
    } finally {
      setPlanningId(null);
    }
  };

  const theme = isDark ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900";
  const card = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";

  return (
    <div className={`min-h-screen p-6 ${theme}`}>
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* HEADER & METRICS */}
        <header className="pb-6 border-b border-gray-700/50">
          <h1 className="text-2xl font-bold">Student Dashboard</h1>
          <p className="opacity-70">Real-time updates from teachers.</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={`p-4 rounded-xl border ${card}`}>
            <p className="text-2xl font-bold">{upcomingClasses.length}</p>
            <span className="opacity-70 text-sm">Total Classes</span>
          </div>
          <div className={`p-4 rounded-xl border ${card}`}>
            <p className="text-2xl font-bold text-green-500">{metrics.active}</p>
            <span className="opacity-70 text-sm">Active</span>
          </div>
          <div className={`p-4 rounded-xl border ${card}`}>
            <p className="text-2xl font-bold text-red-500">{metrics.cancelled}</p>
            <span className="opacity-70 text-sm">Cancelled</span>
          </div>
        </div>

        {/* SCHEDULE LIST */}
        <h2 className="text-lg font-bold pt-4">Your Schedule</h2>
        
        {loading ? <div className="text-center opacity-50 py-10">Loading schedule...</div> : 
         upcomingClasses.length === 0 ? <div className="text-center opacity-50 py-10">No classes found.</div> : (
          <div className="grid gap-4 md:grid-cols-2">
            {upcomingClasses.map((cls) => (
              <div key={cls.id} className={`p-5 rounded-xl border relative transition-all ${cls.isCancelled ? 'border-red-500/40 bg-red-500/5' : card}`}>
                
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className={`font-bold text-lg ${cls.isCancelled ? 'line-through opacity-60' : ''}`}>{cls.subject}</h3>
                    <div className="flex items-center gap-2 text-sm opacity-70 mt-1">
                      <Clock size={14} /> {cls.time} • {cls.day}
                    </div>
                  </div>
                  {cls.isCancelled && <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded">CANCELLED</span>}
                </div>

                {/* --- PLAN NOW SECTION --- */}
                {cls.isCancelled && (
                  <div className={`mt-4 p-3 rounded-lg border ${isDark ? 'bg-red-900/10 border-red-500/20' : 'bg-red-50 border-red-100'}`}>
                    
                    {aiPlans[cls.id] ? (
                      <div className="animate-in fade-in">
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles className="w-4 h-4 text-indigo-500" />
                          <span className="text-sm font-bold text-indigo-500">AI Plan:</span>
                        </div>
                        <p className="text-sm opacity-90">{aiPlans[cls.id]}</p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Brain className="w-5 h-5 text-indigo-500" />
                          <div className="text-sm">
                            <span className="font-bold text-indigo-400">Free Time!</span>
                            <p className="opacity-70 text-xs">Utilize this hour?</p>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => handlePlanFreeTime(cls)}
                          disabled={planningId === cls.id}
                          className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg flex items-center gap-1 transition-colors shadow-lg shadow-indigo-500/30"
                        >
                          {planningId === cls.id ? <Loader2 className="animate-spin" size={12}/> : "Plan Now"}
                        </button>
                      </div>
                    )}

                  </div>
                )}

              </div>
            ))}
          </div>
        )}

        {/* FOCUS TIMER SECTION */}
        <div className="mt-8 p-1 rounded-xl" style={{
          background: 'linear-gradient(to right, #4f46e5, #9333ea)',
          padding: '2px' // Creates a gradient border effect
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