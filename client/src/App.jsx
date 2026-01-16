import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import UnifiedDashboard from './components/UnifiedDashboard';
import TeacherDashBoard from './components/TeacherDashBoard';
import Analytics from './components/Analytics';
import Profile from './components/Profile';
import Settings from './components/Settings';
import Sidebar from './components/Sidebar';
import Signup from './components/Signup';
import StudentLogin from './components/StudentLogin';
import TeacherLogin from './components/TeacherLogin';
import Timetable from './components/Timetable';
import LandingPage from './components/LandingPage';
import Chatbot from './components/Chatbot';
import { Bot, ArrowUp, X } from 'lucide-react';
import { API_BASE_URL } from "./config";
// Firebase Imports
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userType, setUserType] = useState('student');
  const [loading, setLoading] = useState(true);

  // --- STATE: Force Landing Page on refresh/logout ---
  const [showWelcome, setShowWelcome] = useState(true);

  const [authView, setAuthView] = useState('landing');
  const [isDark, setIsDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showChat, setShowChat] = useState(false);

  // 1. Listen for Real-time Auth State Changes
  useEffect(() => {
    let intervalId;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // --- PRESENCE LOGIC ---
          const userRef = doc(db, "users", user.uid);
          const updatePresence = async () => {
            await updateDoc(userRef, {
              isOnline: true,
              lastSeen: serverTimestamp()
            }).catch(err => console.log("Presence update failed", err));
          };

          // Initial update
          updatePresence();

          // Heartbeat every 2 minutes
          intervalId = setInterval(updatePresence, 2 * 60 * 1000);

          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            setUserType(userDoc.data().role);
          }
          setIsLoggedIn(true);
          setShowWelcome(false); // Logged in? Hide welcome screen
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      } else {
        setIsLoggedIn(false);
        if (intervalId) clearInterval(intervalId);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  // 2. FIX: Handle Browser Back Button ("Swipe Back")
  // This replaces the crashing <Navigate> logic
  useEffect(() => {
    const handlePopState = (event) => {
      // If we are logged out and swipe back...
      if (!isLoggedIn) {
        // If the history state is null or 'landing', show the Welcome Screen
        if (!event.state || event.state.view === 'landing') {
          setShowWelcome(true);
          setAuthView('landing');
        }
        // If we swiped back to a specific form (like Login/Signup)
        else if (event.state && event.state.view) {
          setShowWelcome(false);
          setAuthView(event.state.view);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isLoggedIn]);

  // 3. Scroll Progress Tracker
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = totalHeight > 0 ? (window.scrollY / totalHeight) * 100 : 0;
      setScrollProgress(progress);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsLoggedIn(false);
      setAuthView('landing');
      setShowWelcome(true); // Reset to Landing Page
      // Clear history so they can't "forward" back into the app
      window.history.replaceState({ view: 'landing' }, '', '/');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // --- NAVIGATION HANDLERS ---
  const handleLandingNavigation = (viewName) => {
    setShowWelcome(false);
    if (!isLoggedIn) {
      setAuthView(viewName);
      // Push state so "Back" button works
      window.history.pushState({ view: viewName }, '', '');
    }
  };

  const switchToSignup = () => handleLandingNavigation('signup');
  const switchToStudentLogin = () => handleLandingNavigation('student-login');
  const switchToTeacherLogin = () => handleLandingNavigation('teacher-login');

  const switchToLanding = () => {
    setAuthView('landing');
    setShowWelcome(true);
    window.history.pushState({ view: 'landing' }, '', '');
  };

  // Loading Screen
  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-blue-600 font-bold">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      Connecting to UniTime...
    </div>
  );

  // --- 1. FORCE LANDING PAGE (Priority #1) ---
  if (showWelcome && !isLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-800">
        <LandingPage
          onSwitchToStudentLogin={switchToStudentLogin}
          onSwitchToTeacherLogin={switchToTeacherLogin}
          onSwitchToSignup={switchToSignup}
        />
      </div>
    );
  }

  // --- 2. AUTH FLOW (Login/Signup Forms) ---
  if (!isLoggedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-800" data-page="auth">
        {authView === 'signup' && (
          <Signup onSwitchToLogin={switchToStudentLogin} onSwitchToLanding={switchToLanding} />
        )}
        {authView === 'student-login' && (
          <StudentLogin
            onLogin={() => setIsLoggedIn(true)}
            onSwitchToSignup={switchToSignup}
            onSwitchToTeacherLogin={switchToTeacherLogin}
            onSwitchToLanding={switchToLanding}
          />
        )}
        {authView === 'teacher-login' && (
          <TeacherLogin
            onLogin={() => setIsLoggedIn(true)}
            onSwitchToSignup={switchToSignup}
            onSwitchToStudentLogin={switchToStudentLogin}
            onSwitchToLanding={switchToLanding}
          />
        )}
        {/* CRITICAL FIX: Removed <Navigate> here to prevent crash */}
      </div>
    );
  }

  // --- 3. MAIN DASHBOARD (Logged In) ---
  return (

    <div className={`flex ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <Sidebar
        onLogout={handleLogout}
        isDark={isDark}
        setIsDark={setIsDark}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      <main className={`flex-1 p-8 transition-all duration-300 ${sidebarOpen ? 'ml-0' : 'lg:ml-0'}`}>
        <Routes>
          <Route path="/" element={
            userType === 'teacher'
              ? <TeacherDashBoard isDark={isDark} setIsDark={setIsDark} onLogout={handleLogout} />
              : <UnifiedDashboard isDark={isDark} />
          } />
          <Route path="/analytics" element={<Analytics isDark={isDark} userType={userType} />} />
          <Route path="/timetable" element={<Timetable isDark={isDark} />} />
          <Route path="/profile" element={<Profile isDark={isDark} userType={userType} />} />
          <Route path="/settings" element={<Settings isDark={isDark} setIsDark={setIsDark} userType={userType} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50 items-end">

        {/* CHATBOT POPUP WINDOW */}
        {showChat && (
          <div className="mb-2 shadow-2xl rounded-xl overflow-hidden transition-all duration-300 origin-bottom-right">
            <Chatbot isDark={isDark} />
          </div>
        )}

        <div className="relative w-16 h-16">
          <svg width="64" height="64" viewBox="0 0 64 64" className="absolute inset-0">
            <circle cx="32" cy="32" r="24" fill={isDark ? '#374151' : '#ffffff'} />
            <circle cx="32" cy="32" r="28" fill="none" stroke={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} strokeWidth="2" />
            <circle cx="32" cy="32" r="28" fill="none" stroke={isDark ? '#60a5fa' : '#2563eb'} strokeWidth="2"
              strokeDasharray={`${(scrollProgress / 100) * 175} 175`} strokeLinecap="round" transform="rotate(-90 32 32)" />
          </svg>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-3 rounded-full text-gray-500 dark:text-gray-400"
          >
            <ArrowUp size={20} />
          </button>
        </div>

        <button
          onClick={() => setShowChat(!showChat)}
          className={`p-4 rounded-full shadow-2xl transition-transform hover:scale-110 ${isDark ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
            }`}
        >
          {showChat ? <X size={24} /> : <Bot size={24} />}
        </button>
      </div>
    </div>

  );
}

export default App;