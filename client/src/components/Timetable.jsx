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
import { isValidSubject } from "../utils/subjectUtils";

const Timetable = ({ isDark }) => {
  const [showTimetable, setShowTimetable] = useState(true);
  const [classes, setClasses] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);


  // INLINED FILTER LOGIC
  const VALID_CODES = [
    "29242201", "29242202", "29242203", "29242204", "29242205",
    "29242206", "29242207", "29242208", "29242209", "29242210",
    "29242211", "29242212", "NECXXXXX", "SIP2XXXX"
  ];
  const SUBJECT_MAP = [
    { keywords: ["data science lab", "science lab"], code: "29242206" },
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

  const getSubjectCode = (str) => {
    if (!str) return null;
    const clean = str.trim();
    const lower = clean.toLowerCase();
    const direct = clean.match(/(\d{8}|NECXXXXX|SIP2XXXX)/);
    if (direct) return direct[0];
    const match = SUBJECT_MAP.find(m => m.keywords.some(k => lower.includes(k)));
    return match ? match.code : null;
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "timetable"), where("userId", "==", auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const filtered = allData.filter(cls => {
        const code = getSubjectCode(cls.subject);
        return code && VALID_CODES.includes(code);
      });
      setClasses(filtered);
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


              {/* Weekly Attendance Removed */}
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