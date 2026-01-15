import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, query, where, onSnapshot, doc, setDoc } from "firebase/firestore"; // Added doc, setDoc
import {
  Calendar, Upload, Clock, MapPin, X, ChevronDown,
  ChevronUp, FileText, Brain, Loader2, ExternalLink, Image as ImageIcon
} from "lucide-react";
import GoogleCalendar from "./GoogleCalendar";
import AcademicManager from './AcademicManager';

import AIStudyAdvisor from './AIStudyAdvisor';

const Timetable = ({ isDark }) => {
  const [showTimetable, setShowTimetable] = useState(true);
  const [classes, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "timetable"), where("userId", "==", auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingClasses(false);
    });
    return () => unsubscribe();
  }, []);



  const theme = isDark ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900";
  const card = isDark ? "bg-white/10 border-white/20" : "bg-white border-gray-200";

  return (
    <div className={`min-h-screen transition-colors ${theme}`}>
      <header className={`sticky top-0 z-50 border-b ${isDark ? "bg-gray-900/80 border-white/10" : "bg-white border-gray-200"} backdrop-blur`}>
        <div className="flex justify-between items-center px-6 py-4">
          <div><h1 className="text-xl font-bold">UniTime</h1><p className="text-sm opacity-70">Academic Documents & Schedule</p></div>
        </div>
      </header>

      <main className="px-6 py-8 max-w-5xl mx-auto space-y-8">

        {/* NEW: Permanent Academic Documents Manager */}
        <div className={`p-6 rounded-xl border shadow-sm ${card}`}>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <FileText className="text-indigo-500" /> Academic Documents
          </h2>
          <AcademicManager isDark={isDark} />
        </div>

        <div className={`rounded-xl border ${card}`}>
          <button onClick={() => setShowTimetable(!showTimetable)} className="w-full px-6 py-4 flex justify-between items-center">
            <span className="flex items-center gap-2 font-semibold"><Calendar /> Class Schedule & AI Optimizer</span>{showTimetable ? <ChevronUp /> : <ChevronDown />}
          </button>

          {showTimetable && (
            <div className="px-6 pb-6 space-y-6">

              {/* File Selection Area */}
              {/* AI Study Advisor */}
              <div className="mt-2">
                <AIStudyAdvisor isDark={isDark} />
              </div>

              {/* AI Analysis Section */}


              {/* Weekly Attendance (Read Only) */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> Weekly Attendance Tracking</h4>
                <div className="space-y-2">
                  {loadingClasses ? (<div className="text-center py-4 opacity-50">Loading classes...</div>) : classes.length > 0 ? classes.map((cls) => (
                    <div key={cls.id} className={`p-3 rounded-lg border ${cls.attended ? isDark ? 'bg-green-900/20 border-green-700' : 'bg-green-50 border-green-200' : isDark ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${cls.attended ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            <span className="font-medium">{cls.subject}</span>
                          </div>
                          <div className="text-sm opacity-70 mt-1">{cls.day} • {cls.time}</div>
                        </div>
                        <div className="flex items-center gap-1 text-sm opacity-70"><MapPin className="w-4 h-4" /> {cls.room}</div>
                      </div>
                    </div>
                  )) : (<p className="text-center py-4 opacity-50">No classes scheduled in database.</p>)}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <GoogleCalendar isDark={isDark} />
        </div>
      </main>
    </div>
  );
};
export default Timetable;