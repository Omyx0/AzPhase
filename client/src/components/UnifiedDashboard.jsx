import React, { useState, useEffect } from "react";
import {
  Clock, Sparkles, Brain, Loader2, BookOpen, Plus, TrendingUp, AlertTriangle, Users
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

      // DEDUPLICATION LOGIC
      // Key: "${day}-${normalizedTime}" -> Class Object
      const classMap = new Map();

      // Helper to normalize time to 24-hour HH:MM format for strict comparison
      const normalizeTime = (t) => {
        if (!t) return "00:00";
        const clean = t.trim().toLowerCase();

        // Extract numbers
        const timePart = clean.replace(/[^\d:]/g, '');
        let [h, m] = timePart.split(':').map(Number);
        if (isNaN(h)) return "00:00";
        if (isNaN(m)) m = 0;

        // Handle AM/PM
        if (clean.includes('pm') && h !== 12) h += 12;
        if (clean.includes('am') && h === 12) h = 0;

        // Return HH:MM
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      };

      merged.forEach(cls => {
        const key = `${cls.day}-${normalizeTime(cls.time)}`;

        if (classMap.has(key)) {
          const existing = classMap.get(key);
          // If current class is TEACHER class and existing is NOT, override.
          // Logic: Official Teacher schedule > Personal scanned schedule
          if (cls.isTeacherClass && !existing.isTeacherClass) {
            classMap.set(key, cls);
          }
          // If both are same source type, first one stays (or logic can be refined)
        } else {
          classMap.set(key, cls);
        }
      });

      const unique = Array.from(classMap.values());

      // Sort
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

      // Recalculate metrics
      const cancelledCount = unique.filter(c => c.isCancelled).length;
      setMetrics(prev => ({
        ...prev,
        active: unique.length - cancelledCount,
        cancelled: cancelledCount
      }));

      setFreeTimeSlots(unique.filter(c => c.isCancelled));
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



        {/* --- SCHEDULE LIST --- */}
        <div className="space-y-8">

          {/* 1. ONGOING / CANCELLED CLASSES SECTION */}
          {upcomingClasses.some(c => c.isCancelled) && (
            <div className="opacity-90">
              <h2 className={`text-lg font-bold mb-4 flex items-center gap-2 ${textPrimary}`}>
                <Clock className="text-blue-500" /> Ongoing Classes
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {upcomingClasses.filter(c => c.isCancelled).map((cls) => (
                  <div key={cls.id} className={`p-5 rounded-xl border border-dashed relative overflow-hidden transition-all ${isDark ? 'bg-red-900/10 border-red-800/30' : 'bg-red-50 border-red-200'}`}>

                    {/* Cancelled Badge Watermark */}
                    <div className="absolute top-2 right-2 opacity-10 rotate-12 pointer-events-none">
                      <span className={`text-4xl font-bold uppercase ${isDark ? 'text-red-500' : 'text-red-600'}`}>Cancelled</span>
                    </div>

                    <div className="flex justify-between items-start mb-3 relative z-10">
                      <div>
                        <h3 className={`font-bold text-lg mb-1 line-through opacity-70 ${textPrimary}`}>{cls.subject}</h3>
                        <div className={`flex items-center gap-2 text-sm opacity-70 ${textSecondary}`}>
                          <Clock size={14} />
                          <span>{cls.time}</span>
                          <span>•</span>
                          <span>{cls.day}</span>
                        </div>
                        <span className={`inline-block mt-2 text-xs font-bold px-2 py-0.5 rounded ${isDark ? 'bg-red-900/40 text-red-300' : 'bg-red-100 text-red-700'}`}>
                          CANCELLED
                        </span>
                      </div>
                    </div>

                    {/* Plan Now Action for Cancelled Classes */}
                    <div className={`mt-4 p-3 rounded-lg border backdrop-blur-sm ${isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-white/60 border-gray-100'}`}>
                      {aiPlans[cls.id] ? (
                        <div className="animate-in fade-in">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Sparkles className="w-4 h-4 text-indigo-500" />
                            <span className={`text-sm font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>AI Utilized Plan:</span>
                          </div>
                          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{aiPlans[cls.id]}</p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Brain className={`w-5 h-5 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                            <div className="text-sm">
                              <span className={`font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>Free Time Found!</span>
                              <p className={`text-xs mt-0.5 ${textSecondary}`}>Use this {cls.time} slot wisely?</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handlePlanFreeTime(cls)}
                            disabled={planningId === cls.id}
                            className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-sm hover:shadow-md disabled:opacity-50"
                          >
                            {planningId === cls.id ? <Loader2 className="animate-spin" size={12} /> : <Sparkles size={12} />}
                            Plan Now
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            </div>
          )}



          {/* 1. MY COURSES / SUBJECT WISE SCHEDULE */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-xl font-bold ${textPrimary}`}>My Courses</h2>
            </div>

            {loading ? (
              <div className={`p-12 rounded-xl border border-dashed ${isDark ? 'border-gray-700' : 'border-gray-200'} flex flex-col items-center justify-center text-center`}>
                <Loader2 className={`w-8 h-8 mb-4 animate-spin ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
                <p className={textSecondary}>Loading course details...</p>
              </div>
            ) : upcomingClasses.length === 0 ? (
              <div className={`p-12 rounded-xl border border-dashed ${isDark ? 'border-gray-700' : 'border-gray-200'} text-center ${textSecondary}`}>
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No enrolled courses found.</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {(() => {
                  // GROUPING LOGIC
                  const courses = {};

                  // SMART MAP: Name Keywords -> Code
                  const SUBJECT_MAP = [
                    { keywords: ["data science lab", "science lab"], code: "29242206" }, // Lab first specific
                    { keywords: ["algorithms lab", "algo lab"], code: "29242207" },
                    { keywords: ["data science", "data sci"], code: "29242201" },
                    { keywords: ["design and analysis", "algorithms", "daa", "dsa"], code: "29242202" },
                    { keywords: ["theory of computation", "toc"], code: "29242203" },
                    { keywords: ["communication", "networks", "cn"], code: "29242204" },
                    { keywords: ["design pattern", "patterns"], code: "29242205" },
                    { keywords: ["competitive programming", "cp"], code: "29242208" },
                    { keywords: ["proficiency"], code: "29242209" },
                    { keywords: ["macro project", "project-ii"], code: "29242210" },
                    { keywords: ["project management", "economics"], code: "29242211" },
                    { keywords: ["mandatory workshop", "intellectual"], code: "29242212" },
                    { keywords: ["novel engaging", "nec"], code: "NECXXXXX" },
                    { keywords: ["internship", "sip"], code: "SIP2XXXX" }
                  ];

                  const VALID_CODES = [
                    "29242201", "29242202", "29242203", "29242204", "29242205",
                    "29242206", "29242207", "29242208", "29242209", "29242210",
                    "29242211", "29242212", "NECXXXXX", "SIP2XXXX"
                  ];

                  upcomingClasses.forEach(cls => {
                    if (cls.isCancelled) return;

                    // 1. Normalize
                    const cleanSubject = cls.subject ? cls.subject.trim() : "Unknown Course";
                    const lowerSub = cleanSubject.toLowerCase();

                    // 2. Smart Extraction
                    let subjectCode = null;

                    // A: Is code already in string?
                    const codeMatch = cleanSubject.match(/(\d{8}|NECXXXXX|SIP2XXXX)/);
                    if (codeMatch) {
                      subjectCode = codeMatch[0];
                    } else {
                      // B: Map by Name
                      const match = SUBJECT_MAP.find(m => m.keywords.some(k => lowerSub.includes(k)));
                      if (match) subjectCode = match.code;
                    }

                    // 3. STRICT FILTER
                    if (!subjectCode || !VALID_CODES.includes(subjectCode)) {
                      return; // Skip if not valid
                    }

                    // 3. Generate Unique Key
                    // If code exists, that IS the key. 
                    // If not, use the full trimmed name to avoid merging unrelated non-coded subjects.
                    const key = subjectCode ? subjectCode : cleanSubject;

                    if (!courses[key]) {
                      courses[key] = {
                        code: subjectCode || '',
                        // If code exists, strip it from name for cleaner display
                        name: subjectCode ? cleanSubject.replace(subjectCode, '').replace(/^[ -]+|[ -]+$/g, '').trim() : cleanSubject,
                        faculty: cls.teacherName || 'Self Schedule',
                        type: cleanSubject.toLowerCase().includes('lab') ? 'LAB' : 'THEORY',
                        schedule: [],
                        totalClasses: 0
                      };
                    }

                    // 4. Add Slot to Schedule
                    // Prevent duplicate slots if data has duplicates (same day/time)
                    const alreadyExists = courses[key].schedule.some(s => s.day === cls.day && s.time === cls.time);
                    if (!alreadyExists) {
                      courses[key].schedule.push({ day: cls.day, time: cls.time, room: cls.room });
                      courses[key].totalClasses++;
                    }
                  });

                  return Object.values(courses).map((course, idx) => (
                    <div key={idx} className={`rounded-xl overflow-hidden border shadow-sm transition-all hover:shadow-lg hover:-translate-y-1 ${card}`}>

                      {/* CARD HEADER */}
                      <div className="p-4 flex justify-between items-start border-b border-gray-100 dark:border-gray-700">
                        <div>
                          <h3 className={`font-bold text-xl ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{course.code}</h3>
                          <p className={`font-semibold text-sm line-clamp-2 h-10 ${textPrimary}`}>{course.name}</p>
                        </div>
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${course.type === 'LAB'
                          ? isDark ? 'bg-green-900/40 text-green-400' : 'bg-green-100 text-green-700'
                          : isDark ? 'bg-blue-900/40 text-blue-400' : 'bg-blue-100 text-blue-700'
                          }`}>
                          {course.type}
                        </span>
                      </div>

                      {/* PROGRESS BAR (Mock Attendance/Progress) */}
                      <div className="px-4 py-3">
                        <div className="flex justify-between text-xs mb-1.5 opacity-80">
                          <span className={textSecondary}>Weekly Load</span>
                          <span className={`font-bold ${textPrimary}`}>{course.totalClasses} Sessions</span>
                        </div>
                        <div className={`w-full h-1.5 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                          <div className={`h-1.5 rounded-full ${isDark ? 'bg-indigo-500' : 'bg-indigo-600'}`} style={{ width: '100%' }}></div>
                        </div>
                      </div>

                      {/* SCHEDULE LIST */}
                      <div className={`px-4 py-3 border-t border-b ${isDark ? 'border-gray-700/50' : 'border-gray-100'} bg-opacity-50 ${isDark ? 'bg-gray-800/50' : 'bg-gray-50/50'}`}>
                        <p className={`text-xs font-bold uppercase tracking-wide mb-2 ${textSecondary}`}>Weekly Schedule</p>
                        <ul className="space-y-2">
                          {course.schedule.map((slot, i) => (
                            <li key={i} className="flex justify-between items-center text-sm">
                              <span className={`font-medium ${textPrimary}`}>{slot.day}</span>
                              <span className={`font-mono text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{slot.time}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Footer Removed */}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>





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
                // Determine display values based on whether it's a raw class or smart slot
                const location = slot.room || (slot.context ? slot.context.location : 'Campus');
                const timeStr = slot.time || (slot.startTime ? `${slot.startTime} - ${slot.endTime}` : 'N/A');
                const duration = "60"; // Default to 60 for cancelled class
                const workload = "Medium";

                return (
                  <div key={idx} className={`p-4 rounded-lg border ${isDark ? 'bg-indigo-900/20 border-indigo-700' : 'bg-indigo-50 border-indigo-200'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className={`font-semibold ${textPrimary}`}>
                          {duration} min free • {timeStr}
                        </p>
                        <p className={`text-sm mt-1 ${textSecondary}`}>
                          📍 {location} • 📚 Workload: {workload}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                          {slot.subject} (Cancelled)
                        </p>
                      </div>
                      <span className={`ml-3 text-xs px-2 py-1 rounded whitespace-nowrap ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'}`}>
                        Cancelled
                      </span>
                    </div>

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