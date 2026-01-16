/**
 * Context-Aware Smart Notifications
 * Intelligent notifications based on class cancellations, upcoming classes, and academic gaps
 */

import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Clock, BookOpen, AlertCircle, CheckCircle, Users } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { detectFreeTime, getCurrentFreeTime } from '../utils/freeTimeDetector';
import { analyzeAcademicGaps, mapFreeTimeToGap } from '../utils/academicGapAnalyzer';

const SmartNotifications = ({ isDark, classes = [] }) => {
  const [notifications, setNotifications] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  // classes is now a prop
  const [assignments, setAssignments] = useState([]);

  const [quizScores, setQuizScores] = useState([]);
  const panelRef = useRef(null);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setShowPanel(false);
      }
    };

    if (showPanel) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPanel]);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Use passed classes prop instead of internal fetch
    checkForNewNotifications(classes, assignments, quizScores);

    // Subscribe to assignments
    const assignmentsQuery = query(
      collection(db, "assignments"),
      where("userId", "==", auth.currentUser.uid)
    );
    const unsubscribeAssignments = onSnapshot(assignmentsQuery, (snapshot) => {
      const assignmentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAssignments(assignmentData);
    });

    // Subscribe to quiz scores
    const scoresQuery = query(
      collection(db, "quiz_scores"),
      where("userId", "==", auth.currentUser.uid)
    );
    const unsubscribeScores = onSnapshot(scoresQuery, (snapshot) => {
      const scoreData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuizScores(scoreData);
    });

    // Check for upcoming classes (every minute)
    const interval = setInterval(() => {
      checkUpcomingClasses(classes);
    }, 60000); // Check every minute

    return () => {
      unsubscribeAssignments();
      unsubscribeScores();
      clearInterval(interval);
    };
  }, [auth.currentUser, assignments, quizScores, classes]);

  const checkForNewNotifications = async (classData, assignmentData, scoreData) => {
    const newNotifications = [];

    // 1. Check for cancelled classes
    const cancelledClasses = classData.filter(c => c.isCancelled && !c.notified);
    cancelledClasses.forEach(cls => {
      const freeTime = detectFreeTime([cls])[0];
      if (freeTime) {
        analyzeAcademicGaps(null, assignmentData, classData, scoreData).then(gaps => {
          const relevantGap = mapFreeTimeToGap(freeTime, gaps);

          let message = `📅 Class cancelled: ${cls.subject} at ${cls.time}`;
          message += ` → ${freeTime.freeTimeDuration} min free`;

          if (relevantGap) {
            message += ` → Revise ${relevantGap.subject || relevantGap.type}`;
            if (relevantGap.insight) {
              message += ` (${relevantGap.insight})`;
            }
          } else {
            message += ` → Use this time to review ${cls.subject}`;
          }

          addNotification({
            type: "class_cancelled",
            title: "Class Cancelled",
            message,
            priority: "high",
            action: "study",
            freeTimeSlot: freeTime,
            gap: relevantGap
          });
        });

        // Mark as notified
        updateDoc(doc(db, "timetable", cls.id), { notified: true });
      }
    });

    // 2. Check for early class completion (if tracking is available)
    // This would require tracking actual class end times
  };

  const checkUpcomingClasses = (classData) => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    classData.forEach(cls => {
      if (cls.isCancelled) return;

      const [time, period] = cls.time.split(' ');
      const [hours, minutes] = time.split(':').map(Number);
      let classHour = hours;
      if (period === 'PM' && hours !== 12) classHour += 12;
      if (period === 'AM' && hours === 12) classHour = 0;

      const classMinutes = classHour * 60 + (minutes || 0);
      const nowMinutes = currentHour * 60 + currentMinute;
      const minutesUntil = classMinutes - nowMinutes;

      // Notify 15 minutes before class
      if (minutesUntil === 15 && !cls.reminded) {
        addNotification({
          type: "upcoming_class",
          title: "Upcoming Class",
          message: `📚 Next class: ${cls.subject} at ${cls.time} (in 15 min) → Quick recap recommended`,
          priority: "medium",
          action: "quick_review",
          subject: cls.subject
        });

        updateDoc(doc(db, "timetable", cls.id), { reminded: true });
      }
    });
  };

  const addNotification = (notification) => {
    const newNotif = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
      read: false
    };

    setNotifications(prev => {
      // Avoid duplicates
      if (prev.find(n => n.message === newNotif.message && !n.read)) {
        return prev;
      }
      return [newNotif, ...prev].slice(0, 10); // Keep last 10
    });
  };

  const markAsRead = (id) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const dismissNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const theme = {
    card: isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200",
    text: isDark ? "text-white" : "text-gray-900",
    muted: isDark ? "text-gray-400" : "text-gray-600",
    bg: isDark ? "bg-gray-900" : "bg-gray-50"
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Notification Bell */}
      <button
        className={`relative p-2.5 rounded-lg ${theme.card} border transition-all hover:shadow-md ${showPanel ? (isDark ? 'bg-indigo-900/30 border-indigo-600' : 'bg-indigo-50 border-indigo-300') : ''
          }`}
        onClick={() => setShowPanel(!showPanel)}
        aria-label="Notifications"
      >
        <Bell className={`w-5 h-5 ${theme.text}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Panel */}
      {showPanel && (
        <div className={`absolute right-0 mt-2 w-80 ${theme.card} border rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto ${isDark ? 'border-gray-700' : 'border-gray-200'
          }`}>
          <div className={`p-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'} flex justify-between items-center`}>
            <h3 className={`font-bold ${theme.text}`}>Notifications</h3>
            <span className={`text-xs ${theme.muted}`}>{unreadCount} unread</span>
          </div>

          <div className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
            {notifications.length === 0 ? (
              <div className={`p-6 text-center ${theme.muted}`}>
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`p-4 hover:${isDark ? 'bg-gray-700' : 'bg-gray-50'} transition-colors ${!notif.read ? (isDark ? 'bg-gray-700/50' : 'bg-blue-50/50') : ''
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${notif.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                      notif.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                      {notif.type === 'class_cancelled' && <AlertCircle className="w-4 h-4" />}
                      {notif.type === 'upcoming_class' && <Clock className="w-4 h-4" />}
                      {notif.type === 'gap_identified' && <BookOpen className="w-4 h-4" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className={`font-semibold text-sm ${theme.text}`}>{notif.title}</p>
                          <p className={`text-xs mt-1 ${theme.muted}`}>{notif.message}</p>
                          <p className={`text-xs mt-2 ${theme.muted}`}>
                            {notif.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                        <button
                          onClick={() => dismissNotification(notif.id)}
                          className={`p-1 rounded hover:${isDark ? 'bg-gray-600' : 'bg-gray-200'} transition-colors`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      {!notif.read && (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          className="mt-2 text-xs text-blue-500 hover:underline"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartNotifications;
