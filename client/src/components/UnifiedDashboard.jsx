import React, { useState, useEffect } from "react";
import {
  Clock, Sparkles, Brain, Loader2, BookOpen, Plus, TrendingUp, AlertTriangle
} from "lucide-react";
import { db, auth } from "../firebase";
import { collection, query, onSnapshot, where, addDoc } from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";
import FocusTimer from './FocusTimer';

// --- IMPORTS ---


import SmartNotifications from './SmartNotifications';
import { detectFreeTime, getCurrentFreeTime } from '../utils/freeTimeDetector';
import { analyzeAcademicGaps, mapFreeTimeToGap } from '../utils/academicGapAnalyzer';

const UnifiedDashboard = ({ isDark }) => {
  const [upcomingClasses, setUpcomingClasses] = useState([]);
  const [metrics, setMetrics] = useState({ active: 0, cancelled: 0, gaps: 0, avgScore: 0 });
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [freeTimeSlots, setFreeTimeSlots] = useState([]);
  const [academicGaps, setAcademicGaps] = useState([]);
  const [currentFreeTime, setCurrentFreeTime] = useState(null);
  const [quizScores, setQuizScores] = useState([]);

  // New State for "Plan Now" Feature
  const [planningId, setPlanningId] = useState(null);
  const [aiPlans, setAiPlans] = useState({});

  // State for Add Score Modal
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [newScore, setNewScore] = useState({ subject: '', score: '', maxScore: '100', topic: '' });

  // Fetch real data from 'timetable' collection
  useEffect(() => {
    if (!auth.currentUser) return;

    // 1. Personal Classes (User specific)
    const qPersonal = query(collection(db, "timetable"), where("userId", "==", auth.currentUser.uid));

    // 2. Teacher/Global Classes
    // Note: In real app, this would filter by specific 'classroomId' the user joined.
    // For now, we fetch all classes created by any teacher to simulate the classroom.
    const qTeacher = query(collection(db, "timetable"), where("teacherId", ">=", " "));

    const unsubPersonal = onSnapshot(qPersonal, (snapshot) => {
      const personalData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // We need to merge inside the callback or use a ref/state combiner.
      // Sinc onSnapshot is async, we'll trigger a merge function.
      updateClasses(personalData, null);
    });

    const unsubTeacher = onSnapshot(qTeacher, (snapshot) => {
      const teacherData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isTeacherClass: true }));
      updateClasses(null, teacherData);
    });

    // Helper to merge state
    let currentPersonal = [];
    let currentTeacher = [];

    const updateClasses = (personal, teacher) => {
      if (personal) currentPersonal = personal;
      if (teacher) currentTeacher = teacher;

      const merged = [...currentPersonal, ...currentTeacher];

      // Deduplicate by ID just in case
      const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());

      // Sort
      // Helper to parse time for sorting
      const parseTime = (str) => {
        if (!str) return 0;
        const [t, p] = str.split(' ');
        let [h, m] = t.split(':').map(Number);
        if (p === 'PM' && h !== 12) h += 12;
        if (p === 'AM' && h === 12) h = 0;
        return h * 60 + (m || 0);
      };

      unique.sort((a, b) => parseTime(a.time) - parseTime(b.time));

      setUpcomingClasses(unique);

      // Recalculate everything driven by 'upcomingClasses'
      const cancelledCount = unique.filter(c => c.isCancelled).length;
      setMetrics(prev => ({
        ...prev,
        active: unique.length - cancelledCount,
        cancelled: cancelledCount
      }));

      setFreeTimeSlots(detectFreeTime(unique));
      setCurrentFreeTime(getCurrentFreeTime(unique));
      setLoading(false);
    };

    return () => { unsubPersonal(); unsubTeacher(); };
  }, []);

  // Fetch assignments & Scores for gap analysis
  useEffect(() => {
    if (!auth.currentUser) return;

    // Subscribe to assignments
    const assignmentsQuery = query(
      collection(db, "assignments"),
      where("userId", "==", auth.currentUser.uid)
    );
    const unsubAssignments = onSnapshot(assignmentsQuery, (snapshot) => {
      const assignmentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAssignments(assignmentData);
    });

    // Subscribe to quiz scores
    const scoresQuery = query(
      collection(db, "quiz_scores"),
      where("userId", "==", auth.currentUser.uid)
    );
    const unsubScores = onSnapshot(scoresQuery, (snapshot) => {
      const scoreData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuizScores(scoreData);
    });

    return () => { unsubAssignments(); unsubScores(); };
  }, []);

  // Run Analysis when data changes
  useEffect(() => {
    const runAnalysis = async () => {
      const gaps = await analyzeAcademicGaps(null, assignments, upcomingClasses, quizScores);
      setAcademicGaps(gaps);

      // Calculate Average Score
      const totalScore = quizScores.reduce((acc, curr) => acc + (curr.score / curr.maxScore * 100), 0);
      const avg = quizScores.length ? Math.round(totalScore / quizScores.length) : 0;

      setMetrics(prev => ({
        ...prev,
        gaps: gaps.length,
        avgScore: avg
      }));
    };

    if (!loading) runAnalysis();
  }, [assignments, upcomingClasses, quizScores, loading]);

  const handleAddScore = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, "quiz_scores"), {
        userId: auth.currentUser.uid,
        subject: newScore.subject,
        score: Number(newScore.score),
        maxScore: Number(newScore.maxScore),
        topic: newScore.topic,
        date: new Date().toISOString()
      });
      setShowScoreModal(false);
      setNewScore({ subject: '', score: '', maxScore: '100', topic: '' });
    } catch (err) {
      console.error("Error adding score:", err);
      alert("Failed to add score");
    }
  };

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
      const modelCandidates = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
      const prompt = `My ${cls.subject} class at ${cls.time} was cancelled. I have a free hour. 
      Create a short, 1-sentence specific study task to revise this subject. 
      Keep it actionable (e.g., "Review Chapter 4 notes on...").`;

      let lastError;
      for (const modelName of modelCandidates) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();
          setAiPlans(prev => ({
            ...prev,
            [cls.id]: text
          }));
          return;
        } catch (error) {
          lastError = error;
          if (error.message?.includes('429') && modelCandidates.indexOf(modelName) < modelCandidates.length - 1) continue;
          throw error;
        }
      }
      throw lastError || new Error("All models failed");
    } catch (error) {
      console.error("AI Error:", error);
      alert("Failed to generate plan. Please try again later.");
    } finally {
      setPlanningId(null);
    }
  };

  const theme = isDark ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900";
  const card = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const textPrimary = isDark ? "text-white" : "text-gray-900";
  const textSecondary = isDark ? "text-gray-400" : "text-gray-600";
  const inputTheme = isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900";

  return (
    <div className={`min-h-screen p-6 ${theme}`}>
      <div className="max-w-6xl mx-auto space-y-8">

        {/* HEADER */}
        <header className={`pb-6 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
          <div>
            <h1 className={`text-2xl font-bold ${textPrimary}`}>Student Dashboard</h1>
            <p className={`${textSecondary}`}>Manage your academics intelligently.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowScoreModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              <Plus size={16} /> Add Score
            </button>
            <SmartNotifications isDark={isDark} />
          </div>
        </header>

        {/* --- ADD SCORE MODAL --- */}
        {showScoreModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className={`w-full max-w-md p-6 rounded-xl shadow-2xl ${card}`}>
              <h3 className={`text-lg font-bold mb-4 ${textPrimary}`}>Record Quiz/Test Score</h3>
              <form onSubmit={handleAddScore} className="space-y-4">
                <div>
                  <label className={`block text-sm mb-1 ${textSecondary}`}>Subject</label>
                  <input
                    className={`w-full px-3 py-2 rounded-lg border ${inputTheme}`}
                    value={newScore.subject}
                    onChange={e => setNewScore({ ...newScore, subject: e.target.value })}
                    placeholder="e.g. Mathematics"
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm mb-1 ${textSecondary}`}>Topic (Optional)</label>
                  <input
                    className={`w-full px-3 py-2 rounded-lg border ${inputTheme}`}
                    value={newScore.topic}
                    onChange={e => setNewScore({ ...newScore, topic: e.target.value })}
                    placeholder="e.g. Calculus"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm mb-1 ${textSecondary}`}>Score</label>
                    <input
                      type="number"
                      className={`w-full px-3 py-2 rounded-lg border ${inputTheme}`}
                      value={newScore.score}
                      onChange={e => setNewScore({ ...newScore, score: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className={`block text-sm mb-1 ${textSecondary}`}>Max Score</label>
                    <input
                      type="number"
                      className={`w-full px-3 py-2 rounded-lg border ${inputTheme}`}
                      value={newScore.maxScore}
                      onChange={e => setNewScore({ ...newScore, maxScore: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowScoreModal(false)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} ${textSecondary}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                  >
                    Save Score
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- METRICS & KPI --- */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={`p-5 rounded-xl border shadow-sm transition-all hover:shadow-md ${card}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
                <BookOpen size={20} />
              </div>
              <span className={`text-sm font-medium ${textSecondary}`}>Learning Gaps</span>
            </div>
            <p className={`text-2xl font-bold ${textPrimary}`}>
              {metrics.gaps} <span className="text-sm font-normal opacity-60">identified</span>
            </p>
          </div>

          <div className={`p-5 rounded-xl border shadow-sm transition-all hover:shadow-md ${card}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-500/10 text-green-500 rounded-lg">
                <TrendingUp size={20} />
              </div>
              <span className={`text-sm font-medium ${textSecondary}`}>Avg Quiz Score</span>
            </div>
            <p className={`text-2xl font-bold ${metrics.avgScore >= 75 ? 'text-green-500' : 'text-yellow-500'}`}>
              {metrics.avgScore}%
            </p>
          </div>

          <div className={`p-5 rounded-xl border shadow-sm transition-all hover:shadow-md ${card}`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                <Clock size={20} />
              </div>
              <span className={`text-sm font-medium ${textSecondary}`}>Free Time Found</span>
            </div>
            <p className={`text-2xl font-bold ${textPrimary}`}>
              {freeTimeSlots.length} <span className="text-sm font-normal opacity-60">slots today</span>
            </p>
          </div>
        </div>



        {/* --- SCHEDULE LIST (Existing) --- */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className={`text-lg font-bold ${textPrimary}`}>Upcoming Schedule</h2>
            {planningId && (
              <div className="flex items-center gap-2 text-indigo-500 animate-pulse">
                <Brain size={16} />
                <span className="text-xs font-semibold">AI Planning...</span>
              </div>
            )}
          </div>

          {loading ? (
            <div className={`p-12 rounded-xl border border-dashed ${isDark ? 'border-gray-700' : 'border-gray-200'} flex flex-col items-center justify-center text-center`}>
              <Loader2 className={`w-8 h-8 mb-4 animate-spin ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
              <p className={textSecondary}>Loading your schedule...</p>
            </div>
          ) : upcomingClasses.length === 0 ? (
            <div className={`p-12 rounded-xl border border-dashed ${isDark ? 'border-gray-700' : 'border-gray-200'} text-center ${textSecondary}`}>
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No classes found for today.</p>
              <p className="text-sm mt-2">Time to relax or catch up on studies!</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {upcomingClasses.map((cls) => (
                <div key={cls.id} className={`p-5 rounded-xl border transition-all hover:shadow-md ${cls.isCancelled ? (isDark ? 'border-red-500/40 bg-red-500/5' : 'border-red-300 bg-red-50/50') : card
                  }`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className={`font-bold text-lg mb-1 ${textPrimary} ${cls.isCancelled ? 'line-through opacity-60' : ''
                        }`}>
                        {cls.subject}
                      </h3>
                      <div className={`flex items-center gap-2 text-sm ${textSecondary}`}>
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
                      <span className={`ml-3 text-xs font-bold px-2.5 py-1 rounded ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
                        }`}>
                        CANCELLED
                      </span>
                    )}
                  </div>

                  {/* AI Plan Result */}
                  {cls.isCancelled && (
                    <div className={`mt-4 p-3 rounded-lg border ${isDark ? 'bg-red-900/10 border-red-500/20' : 'bg-red-50 border-red-100'}`}>
                      {aiPlans[cls.id] ? (
                        <div className="animate-in fade-in">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Sparkles className="w-4 h-4 text-indigo-500" />
                            <span className={`text-sm font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>AI Plan:</span>
                          </div>
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{aiPlans[cls.id]}</p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Brain className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                            <div className="text-sm">
                              <span className={`font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>Free Time!</span>
                              <p className={`text-xs mt-0.5 ${textSecondary}`}>Utilize this hour?</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handlePlanFreeTime(cls)}
                            disabled={planningId === cls.id}
                            className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {planningId === cls.id ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                            Plan Now
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
              <h2 className={`text-lg font-bold ${textPrimary}`}>Smart Free-Time Detection</h2>
            </div>
            <div className="space-y-3">
              {freeTimeSlots.slice(0, 3).map((slot, idx) => {
                const mappedGap = mapFreeTimeToGap(slot, academicGaps);
                return (
                  <div key={idx} className={`p-4 rounded-lg border ${isDark ? 'bg-indigo-900/20 border-indigo-700' : 'bg-indigo-50 border-indigo-200'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className={`font-semibold ${textPrimary}`}>
                          {slot.freeTimeDuration} min free ({slot.startTime} - {slot.endTime})
                        </p>
                        <p className={`text-sm mt-1 ${textSecondary}`}>
                          📍 {slot.context.location} • 📚 Workload: {slot.context.dayWorkloadLevel}
                        </p>
                        {slot.context.previousSubject && slot.context.nextSubject && (
                          <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            Between: {slot.context.previousSubject} → {slot.context.nextSubject}
                          </p>
                        )}
                      </div>
                      <span className={`ml-3 text-xs px-2 py-1 rounded whitespace-nowrap ${slot.type === 'cancelled'
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




        {/* --- FOCUS TIMER --- */}
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