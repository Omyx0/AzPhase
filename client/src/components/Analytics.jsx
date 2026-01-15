import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { TrendingUp, Clock, Target, Award, BarChart3, PieChart, Users } from "lucide-react";
// IMPORT CALENDAR
import GoogleCalendar from "./GoogleCalendar";

export default function Analytics({ isDark, userType = 'student' }) {
  // Initial State
  const [metrics, setMetrics] = useState({ 
    totalHours: '0', 
    productive: '0%', 
    streak: '0', 
    sessions: '0' 
  });
  const [weeklyData, setWeeklyData] = useState([]);
  const [subjectBreakdown, setSubjectBreakdown] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  // Styling Variables
  const cardClass = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200";
  const textClass = isDark ? "text-white" : "text-gray-900";
  const mutedTextClass = isDark ? "text-gray-300" : "text-gray-600";

  // --- MAIN LOGIC ENGINE ---
  useEffect(() => {
    if (!auth.currentUser) return;

    // 1. Fetch RAW data from 'study_sessions' (Created by FocusTimer)
    const sessionsRef = collection(db, "study_sessions");
    const q = query(
      sessionsRef, 
      where("userId", "==", auth.currentUser.uid),
      orderBy("timestamp", "desc") // Latest first
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessions = snapshot.docs.map(doc => doc.data());
      
      calculateAnalytics(sessions);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userType]);

  // --- CALCULATION FUNCTION ---
  const calculateAnalytics = (data) => {
    if (data.length === 0) {
      setLoading(false);
      return;
    }

    // 1. Total Hours & Sessions
    const totalMinutes = data.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);
    const totalHours = (totalMinutes / 60).toFixed(1);
    const totalSessions = data.length;

    // 2. Subject Breakdown Logic
    const subjectMap = {};
    data.forEach(session => {
      const sub = session.subject || "Unknown";
      if (!subjectMap[sub]) subjectMap[sub] = 0;
      subjectMap[sub] += session.durationMinutes;
    });

    // Convert map to array for Pie Chart
    const breakdownArray = Object.keys(subjectMap).map((key, index) => ({
      subject: key,
      hours: (subjectMap[key] / 60).toFixed(1),
      percentage: ((subjectMap[key] / totalMinutes) * 100).toFixed(0),
      color: getColor(index) // Helper function for colors
    })).sort((a, b) => b.percentage - a.percentage); // Sort by highest %

    // 3. Weekly Progress (Last 7 Days)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const last7Days = [...Array(7)].map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - i);
        return d.toISOString().split('T')[0]; // "2024-01-14"
    }).reverse();

    const weeklyStats = last7Days.map(dateStr => {
        // Find sessions that match this date
        const daySessions = data.filter(s => s.date === dateStr);
        const dayMinutes = daySessions.reduce((acc, curr) => acc + curr.durationMinutes, 0);
        const dayName = days[new Date(dateStr).getDay()];
        
        return {
            day: dayName,
            hours: (dayMinutes / 60).toFixed(1),
            value: Math.min((dayMinutes / 60) * 20, 100) // Bar height (max 5 hours = 100%)
        };
    });

    // 4. Streak Calculation
    // Get unique dates sorted descending
    const uniqueDates = [...new Set(data.map(s => s.date))].sort().reverse();
    let currentStreak = 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Agar aaj ya kal padha hai, toh streak count shuru karo
    if (uniqueDates.includes(today) || uniqueDates.includes(yesterdayStr)) {
        currentStreak = 1;
        // Check backwards logic can be complex, keeping simple for now
        // For accurate streak, we need to check consecutive days
        for (let i = 0; i < uniqueDates.length - 1; i++) {
             const d1 = new Date(uniqueDates[i]);
             const d2 = new Date(uniqueDates[i+1]);
             const diffTime = Math.abs(d1 - d2);
             const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
             if (diffDays === 1) {
                 currentStreak++;
             } else {
                 break;
             }
        }
    }

    // Update State
    setMetrics({
        totalHours: `${totalHours}h`,
        productive: '92%', // Placeholder (Focus Score logic can be added later)
        streak: `${currentStreak}`,
        sessions: `${totalSessions}`
    });
    setWeeklyData(weeklyStats);
    setSubjectBreakdown(breakdownArray);
  };

  // Helper to give colors to subjects
  const getColor = (index) => {
    const colors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-yellow-500", "bg-red-500"];
    return colors[index % colors.length];
  };

  if (loading) return <div className={`p-8 text-center animate-pulse ${textClass}`}>Syncing Study Data...</div>;

  return (
    <div className="space-y-6 min-h-screen">
      <div>
        <h1 className={`text-3xl font-bold ${textClass}`}>Analytics</h1>
        <p className={`mt-2 ${mutedTextClass}`}>{userType === 'teacher' ? 'Track performance' : 'Track your academic progress'}</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard icon={userType === 'teacher' ? <Users /> : <Clock />} value={metrics.totalHours} label={userType === 'teacher' ? 'Teaching Hours' : 'Total Study Hours'} color="text-blue-500" {...{cardClass, textClass, mutedTextClass}} />
        <MetricCard icon={<Target />} value={metrics.productive} label={userType === 'teacher' ? 'Avg Attendance' : 'Focus Score'} color="text-green-500" {...{cardClass, textClass, mutedTextClass}} />
        <MetricCard icon={<TrendingUp />} value={metrics.streak} label={userType === 'teacher' ? 'Week Streak' : 'Day Streak'} color="text-purple-500" {...{cardClass, textClass, mutedTextClass}} />
        <MetricCard icon={<Award />} value={metrics.sessions} label={userType === 'teacher' ? 'Classes' : 'Total Sessions'} color="text-yellow-500" {...{cardClass, textClass, mutedTextClass}} />
      </div>

      {/* Graphs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Weekly Chart */}
          <div className={`p-6 rounded-xl border ${cardClass}`}>
            <h2 className={`text-xl font-semibold mb-6 flex items-center gap-2 ${textClass}`}><BarChart3 className="w-5 h-5 text-blue-500" /> Weekly Activity</h2>
            <div className="space-y-4">
              {weeklyData.length > 0 ? weeklyData.map((day, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className={`w-12 text-sm font-medium ${textClass}`}>{day.day}</div>
                  <div className="flex-1">
                      <div className={`h-4 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-100'} relative overflow-hidden`}>
                          <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${day.value}%` }}></div>
                      </div>
                  </div>
                  <div className={`w-16 text-sm text-right ${textClass}`}>{day.hours}h</div>
                </div>
              )) : <p className="text-gray-400 text-sm">No study data for this week.</p>}
            </div>
          </div>

          {/* Subject Breakdown Pie */}
          <div className={`p-6 rounded-xl border ${cardClass}`}>
            <h2 className={`text-xl font-semibold mb-6 flex items-center gap-2 ${textClass}`}><PieChart className="w-5 h-5 text-green-500" /> Subject Breakdown</h2>
            <div className="space-y-4">
              {subjectBreakdown.length > 0 ? subjectBreakdown.map((subject, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${subject.color}`}></div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                        <span className={`font-medium ${textClass}`}>{subject.subject}</span>
                        <span className={`text-sm ${mutedTextClass}`}>{subject.hours}h</span>
                    </div>
                    <div className={`h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                        <div className={`h-full rounded-full ${subject.color} transition-all duration-500`} style={{ width: `${subject.percentage}%` }}></div>
                    </div>
                  </div>
                </div>
              )) : <p className="text-gray-400 text-sm">Start a Focus Session to see data here.</p>}
            </div>
          </div>
      </div>

      {/* --- GOOGLE CALENDAR SECTION --- */}
      <div className="mt-8">
         <h2 className={`text-xl font-semibold mb-4 ${textClass}`}>Your Schedule</h2>
         <GoogleCalendar isDark={isDark} />
      </div>
    </div>
  );
}

function MetricCard({ icon, value, label, color, cardClass, textClass, mutedTextClass }) {
  return (
    <div className={`p-6 rounded-xl border ${cardClass} hover:shadow-lg transition-shadow duration-200`}>
      <div className="flex items-center gap-3">
        <div className={color}>{React.cloneElement(icon, { size: 32 })}</div>
        <div>
            <p className={`text-2xl font-bold ${textClass}`}>{value}</p>
            <p className={`text-sm ${mutedTextClass}`}>{label}</p>
        </div>
      </div>
    </div>
  );
}