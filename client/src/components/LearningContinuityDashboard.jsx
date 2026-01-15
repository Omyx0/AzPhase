/**
 * Learning Continuity Dashboard
 * Enhanced dashboard showing productivity metrics, streaks, gap closure, and academic improvement
 */

import React, { useState, useEffect } from 'react';
import { TrendingUp, Target, Award, Flame, CheckCircle, Clock, BookOpen, BarChart3 } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { detectFreeTime } from '../utils/freeTimeDetector';
import { analyzeAcademicGaps } from '../utils/academicGapAnalyzer';

const LearningContinuityDashboard = ({ isDark, classes, assignments, quizScores }) => {
  const [metrics, setMetrics] = useState({
    productiveTimePercentage: 0,
    gapsClosed: 0,
    dailyStreak: 0,
    weeklyStreak: 0,
    weeklyImprovement: 0,
    freeTimeUtilized: 0,
    totalFreeTime: 0
  });
  const [weeklyProgress, setWeeklyProgress] = useState([]);
  const [recentGapsClosed, setRecentGapsClosed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Subscribe to study sessions
    const sessionsQuery = query(
      collection(db, "study_sessions"),
      where("userId", "==", auth.currentUser.uid),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(sessionsQuery, async (snapshot) => {
      const sessions = snapshot.docs.map(doc => doc.data());
      await calculateContinuityMetrics(sessions, classes, assignments, quizScores);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth.currentUser, classes, assignments, quizScores]);

  const calculateContinuityMetrics = async (sessions, classes, assignments, quizScores) => {
    // 1. Calculate productive time percentage
    const freeTimeSlots = detectFreeTime(classes || []);
    const totalFreeTimeMinutes = freeTimeSlots.reduce((sum, slot) => sum + slot.freeTimeDuration, 0);
    
    // Calculate study sessions that occurred during free time
    const productiveMinutes = sessions.reduce((sum, session) => {
      if (!session.timestamp) return sum;
      const sessionTime = new Date(session.timestamp?.seconds ? session.timestamp.seconds * 1000 : session.timestamp);
      const wasDuringFreeTime = freeTimeSlots.some(slot => {
        if (!slot.startTime) return false;
        const slotStart = parseTime(slot.startTime);
        const slotEnd = slotStart + slot.freeTimeDuration;
        const sessionMinutes = sessionTime.getHours() * 60 + sessionTime.getMinutes();
        return sessionMinutes >= slotStart && sessionMinutes <= slotEnd;
      });
      return wasDuringFreeTime ? sum + (session.durationMinutes || 0) : sum;
    }, 0);

    const productivePercentage = totalFreeTimeMinutes > 0
      ? Math.round((productiveMinutes / totalFreeTimeMinutes) * 100)
      : 0;

    // 2. Calculate gaps closed
    const gaps = await analyzeAcademicGaps(null, assignments || [], classes || [], quizScores || []);
    const closedGaps = sessions.filter(s => s.gapClosed).length;

    // 3. Calculate study streaks
    const { dailyStreak, weeklyStreak } = calculateStreaks(sessions);

    // 4. Calculate weekly improvement
    const improvement = calculateWeeklyImprovement(sessions);

    // 5. Weekly progress data
    const weeklyData = calculateWeeklyProgress(sessions);

    setMetrics({
      productiveTimePercentage: productivePercentage,
      gapsClosed: closedGaps,
      dailyStreak,
      weeklyStreak,
      weeklyImprovement: improvement,
      freeTimeUtilized: productiveMinutes,
      totalFreeTime: totalFreeTimeMinutes
    });

    setWeeklyProgress(weeklyData);
  };

  const calculateStreaks = (sessions) => {
    if (!sessions || sessions.length === 0) return { dailyStreak: 0, weeklyStreak: 0 };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const datesWithSessions = new Set(
      sessions.map(s => {
        const date = new Date(s.timestamp?.seconds * 1000 || s.timestamp);
        date.setHours(0, 0, 0, 0);
        return date.toISOString();
      })
    );

    // Daily streak
    let dailyStreak = 0;
    let checkDate = new Date(today);
    while (datesWithSessions.has(checkDate.toISOString())) {
      dailyStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Weekly streak (weeks with at least 3 study days)
    const weeksWithActivity = new Set();
    sessions.forEach(s => {
      const date = new Date(s.timestamp?.seconds * 1000 || s.timestamp);
      const weekStart = getWeekStart(date);
      const weekKey = weekStart.toISOString();
      if (!weeksWithActivity.has(weekKey)) {
        const weekSessions = sessions.filter(ss => {
          const ssDate = new Date(ss.timestamp?.seconds * 1000 || ss.timestamp);
          return getWeekStart(ssDate).toISOString() === weekKey;
        });
        const uniqueDays = new Set(weekSessions.map(ss => {
          const ssDate = new Date(ss.timestamp?.seconds * 1000 || ss.timestamp);
          ssDate.setHours(0, 0, 0, 0);
          return ssDate.toISOString();
        }));
        if (uniqueDays.size >= 3) {
          weeksWithActivity.add(weekKey);
        }
      }
    });

    const sortedWeeks = Array.from(weeksWithActivity).sort().reverse();
    let weeklyStreak = 0;
    const currentWeek = getWeekStart(today).toISOString();
    if (sortedWeeks[0] === currentWeek) {
      weeklyStreak = 1;
      for (let i = 1; i < sortedWeeks.length; i++) {
        const prevWeek = new Date(sortedWeeks[i - 1]);
        const currentWeek = new Date(sortedWeeks[i]);
        const diffDays = Math.abs((prevWeek - currentWeek) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
          weeklyStreak++;
        } else {
          break;
        }
      }
    }

    return { dailyStreak, weeklyStreak };
  };

  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    const weekStart = new Date(d.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  };

  const calculateWeeklyImprovement = (sessions) => {
    if (sessions.length < 2) return 0;

    const lastWeek = sessions
      .filter(s => {
        const date = new Date(s.timestamp?.seconds * 1000 || s.timestamp);
        const daysAgo = (new Date() - date) / (1000 * 60 * 60 * 24);
        return daysAgo <= 7;
      })
      .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

    const previousWeek = sessions
      .filter(s => {
        const date = new Date(s.timestamp?.seconds * 1000 || s.timestamp);
        const daysAgo = (new Date() - date) / (1000 * 60 * 60 * 24);
        return daysAgo > 7 && daysAgo <= 14;
      })
      .reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

    if (previousWeek === 0) return lastWeek > 0 ? 100 : 0;
    return Math.round(((lastWeek - previousWeek) / previousWeek) * 100);
  };

  const calculateWeeklyProgress = (sessions) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        date: d.toISOString().split('T')[0],
        day: days[d.getDay()],
        hours: 0,
        gapsClosed: 0
      };
    });

    sessions.forEach(session => {
      if (!session.timestamp) return;
      try {
        const sessionDate = session.timestamp?.seconds 
          ? new Date(session.timestamp.seconds * 1000)
          : new Date(session.timestamp);
        const dateStr = sessionDate.toISOString().split('T')[0];
        const dayData = last7Days.find(d => d.date === dateStr);
        if (dayData) {
          dayData.hours += (session.durationMinutes || 0) / 60;
          if (session.gapClosed) {
            dayData.gapsClosed++;
          }
        }
      } catch (error) {
        console.error("Error processing session date:", error);
      }
    });

    return last7Days;
  };

  const parseTime = (timeStr) => {
    if (!timeStr) return 0;
    try {
      const [time, period] = timeStr.split(' ');
      const [hours, minutes] = time.split(':').map(Number);
      let hour24 = hours;
      if (period === 'PM' && hours !== 12) hour24 += 12;
      if (period === 'AM' && hours === 12) hour24 = 0;
      return hour24 * 60 + (minutes || 0);
    } catch {
      return 0;
    }
  };

  const theme = {
    card: isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200",
    text: isDark ? "text-white" : "text-gray-900",
    muted: isDark ? "text-gray-400" : "text-gray-600"
  };

  if (loading) {
    return (
      <div className={`p-6 rounded-xl border ${theme.card}`}>
        <div className={`flex items-center justify-center gap-2 py-8 ${theme.muted}`}>
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading continuity metrics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-xl border ${theme.card}`}>
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="w-6 h-6 text-indigo-500" />
        <h2 className={`text-xl font-bold ${theme.text}`}>Learning Continuity Dashboard</h2>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className={`p-4 rounded-lg border ${isDark ? 'bg-indigo-900/20 border-indigo-700' : 'bg-indigo-50 border-indigo-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-indigo-500" />
            <span className={`text-xs font-semibold ${theme.muted}`}>Productive Time</span>
          </div>
          <p className={`text-2xl font-bold ${theme.text}`}>{metrics.productiveTimePercentage}%</p>
          <p className={`text-xs ${theme.muted}`}>
            {Math.round(metrics.freeTimeUtilized / 60)}h / {Math.round(metrics.totalFreeTime / 60)}h
          </p>
        </div>

        <div className={`p-4 rounded-lg border ${isDark ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className={`text-xs font-semibold ${theme.muted}`}>Gaps Closed</span>
          </div>
          <p className={`text-2xl font-bold ${theme.text}`}>{metrics.gapsClosed}</p>
          <p className={`text-xs ${theme.muted}`}>Learning gaps resolved</p>
        </div>

        <div className={`p-4 rounded-lg border ${isDark ? 'bg-orange-900/20 border-orange-700' : 'bg-orange-50 border-orange-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className={`text-xs font-semibold ${theme.muted}`}>Daily Streak</span>
          </div>
          <p className={`text-2xl font-bold ${theme.text}`}>{metrics.dailyStreak}</p>
          <p className={`text-xs ${theme.muted}`}>Days in a row</p>
        </div>

        <div className={`p-4 rounded-lg border ${isDark ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className={`text-xs font-semibold ${theme.muted}`}>Weekly Growth</span>
          </div>
          <p className={`text-2xl font-bold ${theme.text}`}>{metrics.weeklyImprovement > 0 ? '+' : ''}{metrics.weeklyImprovement}%</p>
          <p className={`text-xs ${theme.muted}`}>vs last week</p>
        </div>
      </div>

      {/* Weekly Progress Chart */}
      <div className="mb-6">
        <h3 className={`font-semibold mb-4 ${theme.text}`}>Weekly Progress</h3>
        <div className="flex items-end gap-2 h-32">
          {weeklyProgress && weeklyProgress.length > 0 ? weeklyProgress.map((day, index) => (
            <div key={index} className="flex-1 flex flex-col items-center gap-2">
              <div className="relative w-full h-24 flex items-end justify-center">
                <div
                  className={`w-full max-w-[40px] rounded-t transition-all ${
                    parseFloat(day.hours || 0) > 0
                      ? isDark ? 'bg-indigo-600' : 'bg-indigo-500'
                      : isDark ? 'bg-gray-700' : 'bg-gray-200'
                  }`}
                  style={{ 
                    height: parseFloat(day.hours || 0) > 0 
                      ? `${Math.min((parseFloat(day.hours) / 6) * 100, 100)}%` 
                      : '4px',
                    minHeight: '4px'
                  }}
                  title={`${parseFloat(day.hours || 0).toFixed(1)}h on ${day.day}`}
                >
                  {day.gapsClosed > 0 && (
                    <div className="absolute -top-2 -right-1 bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md">
                      {day.gapsClosed}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-xs text-center w-full">
                <p className={`font-semibold ${theme.text}`}>{day.day}</p>
                <p className={theme.muted}>{parseFloat(day.hours || 0).toFixed(1)}h</p>
              </div>
            </div>
          )) : (
            <div className={`w-full text-center py-8 ${theme.muted}`}>
              <p className="text-sm">No progress data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Academic Growth Indicator */}
      <div className={`p-4 rounded-lg border ${isDark ? 'bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border-indigo-700' : 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`font-semibold ${theme.text}`}>Academic Growth</p>
            <p className={`text-sm ${theme.muted}`}>
              {metrics.weeklyImprovement > 0
                ? `You're improving! ${metrics.weeklyImprovement}% more productive than last week.`
                : metrics.weeklyImprovement < 0
                ? `Down ${Math.abs(metrics.weeklyImprovement)}% from last week. Keep going!`
                : 'Maintaining consistent progress.'}
            </p>
          </div>
          <Award className={`w-8 h-8 ${metrics.weeklyImprovement > 0 ? 'text-yellow-500' : theme.muted}`} />
        </div>
      </div>
    </div>
  );
};

export default LearningContinuityDashboard;
