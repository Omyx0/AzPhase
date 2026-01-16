import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from "firebase/firestore";
import { TrendingUp, Clock, Target, Award, BarChart3, PieChart, Users, Sparkles } from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";
// GoogleCalendar import removed
import LearningContinuityDashboard from "./LearningContinuityDashboard";
import PeerCollaboration from "./PeerCollaboration";

// --- MAIN ANALYTICS COMPONENT ---
export default function Analytics({ isDark, userType = 'student' }) {
  const [metrics, setMetrics] = useState({
    totalHours: '0', productive: '0%', streak: '0', sessions: '0'
  });
  const [weeklyData, setWeeklyData] = useState([]);
  const [subjectBreakdown, setSubjectBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const cardClass = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const textClass = isDark ? "text-white" : "text-gray-900";
  const mutedTextClass = isDark ? "text-gray-300" : "text-gray-600";

  // --- EXISTING LOGIC ENGINE ---
  useEffect(() => {
    if (!auth.currentUser) return;

    const sessionsRef = collection(db, "study_sessions");
    const q = query(
      sessionsRef,
      where("userId", "==", auth.currentUser.uid),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions = snapshot.docs.map(doc => doc.data());
      calculateAnalytics(sessions);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userType]);

  // Fetch classes and assignments for continuity dashboard
  useEffect(() => {
    if (!auth.currentUser || userType !== 'student') return;

    const classesQuery = query(
      collection(db, "timetable"),
      where("userId", "==", auth.currentUser.uid)
    );
    const unsubscribeClasses = onSnapshot(classesQuery, (snapshot) => {
      const classData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClasses(classData);
    });

    const assignmentsQuery = query(
      collection(db, "assignments"),
      where("userId", "==", auth.currentUser.uid)
    );
    const unsubscribeAssignments = onSnapshot(assignmentsQuery, (snapshot) => {
      const assignmentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAssignments(assignmentData);
    });

    return () => {
      unsubscribeClasses();
      unsubscribeAssignments();
    };
  }, [userType]);

  const calculateAnalytics = (data) => {
    if (data.length === 0) { setLoading(false); return; }

    const totalMinutes = data.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);
    const totalSessions = data.length;

    const subjectMap = {};
    data.forEach(session => {
      const sub = session.subject || "Unknown";
      if (!subjectMap[sub]) subjectMap[sub] = 0;
      subjectMap[sub] += session.durationMinutes;
    });

    const breakdownArray = Object.keys(subjectMap).map((key, index) => ({
      subject: key,
      hours: (subjectMap[key] / 60).toFixed(1),
      percentage: ((subjectMap[key] / totalMinutes) * 100).toFixed(0),
      color: getColor(index)
    })).sort((a, b) => b.percentage - a.percentage);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const weeklyStats = last7Days.map(dateStr => {
      const daySessions = data.filter(s => s.date === dateStr);
      const dayMinutes = daySessions.reduce((acc, curr) => acc + curr.durationMinutes, 0);
      const dayName = days[new Date(dateStr).getDay()];
      return {
        day: dayName,
        hours: (dayMinutes / 60).toFixed(1),
        value: Math.min((dayMinutes / 60) * 20, 100)
      };
    });

    const uniqueDates = [...new Set(data.map(s => s.date))].sort().reverse();
    let currentStreak = 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (uniqueDates.includes(today) || uniqueDates.includes(yesterday.toISOString().split('T')[0])) {
      currentStreak = 1;
      // Simple streak logic for demo
      for (let i = 0; i < uniqueDates.length - 1; i++) {
        const d1 = new Date(uniqueDates[i]);
        const d2 = new Date(uniqueDates[i + 1]);
        const diffDays = Math.ceil(Math.abs(d1 - d2) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) currentStreak++;
        else break;
      }
    }

    setMetrics({
      totalHours: `${totalHours}h`,
      productive: '92%',
      streak: `${currentStreak}`,
      sessions: `${totalSessions}`
    });
    setWeeklyData(weeklyStats);
    setSubjectBreakdown(breakdownArray);
  };

  const getColor = (index) => {
    const colors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-yellow-500", "bg-red-500"];
    return colors[index % colors.length];
  };

  if (loading && metrics.totalHours === '0') {
    return (
      <div className={`p-8 text-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className={textClass}>Loading Analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 min-h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div>
        <h1 className={`text-3xl font-bold ${textClass}`}>Analytics</h1>
        <p className={`mt-2 ${mutedTextClass}`}>
          {userType === 'teacher' ? 'Track performance' : 'Track your academic progress'}
        </p>
      </div>

      {/* --- NEW: AI READINESS SCORE (Student Only) --- */}
      {userType === 'student' && <AIReadinessScore isDark={isDark} />}

      {/* Metrics Grid */}
      {/* Metrics Grid - Hidden for Students (They use Learning Continuity Dashboard) */}
      {userType !== 'student' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <MetricCard icon={userType === 'teacher' ? <Users /> : <Clock />} value={metrics.totalHours} label={userType === 'teacher' ? 'Teaching Hours' : 'Total Study Hours'} color="text-blue-500" {...{ cardClass, textClass, mutedTextClass }} />
          <MetricCard icon={<Target />} value={metrics.productive} label={userType === 'teacher' ? 'Avg Attendance' : 'Focus Score'} color="text-green-500" {...{ cardClass, textClass, mutedTextClass }} />
          <MetricCard icon={<TrendingUp />} value={metrics.streak} label={userType === 'teacher' ? 'Week Streak' : 'Day Streak'} color="text-purple-500" {...{ cardClass, textClass, mutedTextClass }} />
          <MetricCard icon={<Award />} value={metrics.sessions} label={userType === 'teacher' ? 'Classes' : 'Total Sessions'} color="text-yellow-500" {...{ cardClass, textClass, mutedTextClass }} />
        </div>
      )}

      {/* Graphs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`p-6 rounded-xl border shadow-sm ${cardClass}`}>
          <h2 className={`text-xl font-semibold mb-6 flex items-center gap-2 ${textClass}`}>
            <BarChart3 className="w-5 h-5 text-blue-500" />
            Weekly Activity
          </h2>
          <div className="space-y-4">
            {weeklyData.length > 0 ? weeklyData.map((day, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className={`w-12 text-sm font-medium ${textClass}`}>{day.day}</div>
                <div className="flex-1">
                  <div className={`h-4 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'} relative overflow-hidden`}>
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(day.value || 0, 0)}%` }}
                    ></div>
                  </div>
                </div>
                <div className={`w-16 text-sm text-right ${textClass}`}>{parseFloat(day.hours || 0).toFixed(1)}h</div>
              </div>
            )) : (
              <div className={`text-center py-8 ${mutedTextClass}`}>
                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No study data for this week.</p>
                <p className="text-xs mt-1 opacity-75">Use Focus Timer to start tracking your progress</p>
              </div>
            )}
          </div>
        </div>

        <div className={`p-6 rounded-xl border shadow-sm ${cardClass}`}>
          <h2 className={`text-xl font-semibold mb-6 flex items-center gap-2 ${textClass}`}>
            <PieChart className="w-5 h-5 text-green-500" />
            Subject Breakdown
          </h2>
          <div className="space-y-4">
            {subjectBreakdown.length > 0 ? subjectBreakdown.map((subject, index) => (
              <div key={index} className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${subject.color} flex-shrink-0`}></div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`font-medium ${textClass}`}>{subject.subject}</span>
                    <span className={`text-sm ${mutedTextClass}`}>{subject.hours}h</span>
                  </div>
                  <div className={`h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                    <div
                      className={`h-full rounded-full ${subject.color} transition-all duration-500`}
                      style={{ width: `${Math.max(parseFloat(subject.percentage || 0), 0)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )) : (
              <div className={`text-center py-8 ${mutedTextClass}`}>
                <PieChart className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Start a Focus Session to see data here.</p>
                <p className="text-xs mt-1 opacity-75">Track time spent on different subjects</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Learning Continuity Dashboard - For Students Only */}
      {userType === 'student' && (
        <LearningContinuityDashboard
          isDark={isDark}
          classes={classes}
          assignments={assignments}
          quizScores={[]}
        />
      )}

      {/* Peer Collaboration - Real Time Online Users */}
      {userType === 'student' && (
        <PeerCollaboration
          isDark={isDark}
          classes={classes} // Still passing classes though mostly unused now, kept for compatibility
        />
      )}

      {/* Google Calendar Removed */}
    </div>
  );
}

// --- SUB-COMPONENT: AI READINESS SCORE ---
const AIReadinessScore = ({ isDark }) => {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const analyze = async () => {
      if (!auth.currentUser) return;
      setLoading(true);

      try {
        const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
        if (!userDoc.exists()) {
          setAnalysis({ error: "User profile not found." });
          setLoading(false);
          return;
        }

        const data = userDoc.data()?.academicData || {};

        // Check if syllabus exists
        if (!data.syllabusUrl) {
          setAnalysis({
            error: "Upload Syllabus in Dashboard for AI Score.",
            score: null,
            topic: null,
            reason: null
          });
          setLoading(false);
          return;
        }

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error("API Key missing");

        const genAI = new GoogleGenerativeAI(apiKey);
        // Use valid stable models (gemini-pro is retired)
        // Updated based on API key availability - only 2.5 models work
        const modelCandidates = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

        const prompt = `Student has uploaded Syllabus (${data.syllabusUrl}) and Scheme (${data.schemeUrl || 'None'}). 
        Based on generic progress, give a readiness score (0-100) and one recommended topic.
        Output format: JSON { "score": 75, "topic": "Graph Algorithms", "reason": "Critical for upcoming finals." }`;

        // Try each model with retry logic for 429 errors
        let lastError;
        let text;
        for (const modelName of modelCandidates) {
          try {
            const model = genAI.getGenerativeModel({ model: modelName });

            // Retry logic for rate limiting (429 errors)
            let retryCount = 0;
            const maxRetries = 2;
            while (retryCount <= maxRetries) {
              try {
                const result = await model.generateContent(prompt);
                text = result.response.text();
                break; // Success, exit retry loop
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
            if (text) break; // Success, exit model loop
          } catch (error) {
            lastError = error;
            // If quota exceeded, try next model
            if (error.message?.includes('429') && modelCandidates.indexOf(modelName) < modelCandidates.length - 1) {
              continue; // Try next model
            }
            throw error; // Re-throw if last model or not quota error
          }
        }

        if (!text) {
          throw lastError || new Error("All models failed");
        }

        // Simple JSON parse attempt
        try {
          const jsonStr = text.match(/\{[\s\S]*\}/)[0];
          setAnalysis(JSON.parse(jsonStr));
        } catch (e) {
          setAnalysis({ score: 60, topic: "Review Syllabus", reason: "Could not parse AI response." });
        }

      } catch (err) {
        console.error("Analysis Error:", err);

        let errorMessage = "AI Service Unavailable";

        if (err.message?.includes('429') || err.message?.includes('quota') || err.message?.includes('Quota')) {
          errorMessage = "⏱️ Free tier quota exceeded (20 requests/day). Please wait 24 hours or upgrade to a paid plan.";
        } else if (err.message?.includes('API key') || err.message?.includes('401') || err.message?.includes('403')) {
          errorMessage = "❌ API key error. Please check your configuration.";
        }

        setAnalysis({
          error: errorMessage,
          score: null,
          topic: null,
          reason: null
        });
      } finally {
        setLoading(false);
      }
    };

    // Only analyze if user is logged in
    if (auth.currentUser) {
      analyze();
    }
  }, [auth.currentUser]);

  const bgClass = isDark ? "bg-indigo-900/20 border-indigo-500/30" : "bg-indigo-50 border-indigo-200";
  const textClass = isDark ? "text-white" : "text-gray-900";

  if (!analysis && !loading) {
    // Initial state - hasn't loaded yet
    return null;
  }

  return (
    <div className={`p-6 rounded-xl border mb-6 shadow-sm ${bgClass}`}>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
        <h2 className={`text-lg font-bold ${textClass}`}>AI Exam Readiness</h2>
      </div>

      {loading ? (
        <div className={`flex items-center gap-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm">Analyzing academic profile...</span>
        </div>
      ) : analysis?.error ? (
        <div className={`p-4 rounded-lg ${isDark ? 'bg-yellow-900/20 border border-yellow-700/50' : 'bg-yellow-50 border border-yellow-200'
          }`}>
          <p className={`text-sm ${isDark ? 'text-yellow-300' : 'text-yellow-800'}`}>
            {analysis.error}
          </p>
        </div>
      ) : analysis?.score !== null && analysis?.score !== undefined ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className={`text-4xl font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>
            {analysis.score}%
          </div>
          <div className={`border-l-2 ${isDark ? 'border-indigo-700' : 'border-indigo-200'} pl-6 flex-1`}>
            <h3 className={`font-bold text-lg mb-1 ${textClass}`}>Focus on: {analysis.topic}</h3>
            <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{analysis.reason}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
};

// --- HELPER COMPONENT ---
function MetricCard({ icon, value, label, color, cardClass, textClass, mutedTextClass }) {
  return (
    <div className={`p-6 rounded-xl border ${cardClass} hover:shadow-lg transition-shadow duration-200`}>
      <div className="flex items-center gap-3">
        <div className={color}>{React.cloneElement(icon, { size: 32 })}</div>
        <div><p className={`text-2xl font-bold ${textClass}`}>{value}</p><p className={`text-sm ${mutedTextClass}`}>{label}</p></div>
      </div>
    </div>
  );
}