import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import {
  ClipboardList, TrendingUp, CheckCircle, Plus, Trash2,
  Clock, MapPin, Loader2, AlertTriangle, Users
} from "lucide-react";
import { isValidSubject } from "../utils/subjectUtils";

const TeacherDashBoard = ({ isDark }) => {
  const [classes, setClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [gapInsights, setGapInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [user, setUser] = useState(null);

  const [newClass, setNewClass] = useState({
    subject: "", time: "", day: "Monday", room: "", isCancelled: false
  });

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);


        // ... inside effect ...
        // 1. Classes
        const q = query(collection(db, "timetable"), where("teacherId", "==", currentUser.uid));

        const unsubClasses = onSnapshot(q, (snapshot) => {
          const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          console.log("Teacher Dashboard - Raw Docs:", allDocs); // DEBUG LOG

          // INLINED FILTER
          const VALID = [
            "29242201", "29242202", "29242203", "29242204", "29242205",
            "29242206", "29242207", "29242208", "29242209", "29242210",
            "29242211", "29242212", "NECXXXXX", "SIP2XXXX"
          ];
          const map = [
            { k: ["data science lab", "science lab"], c: "29242206" },
            { k: ["algorithms lab", "algo lab"], c: "29242207" },
            { k: ["data science", "data sci"], c: "29242201" },
            { k: ["design and analysis", "algorithms", "daa", "dsa"], c: "29242202" },
            { k: ["theory of computation", "toc"], c: "29242203" },
            { k: ["communication", "networks", "cn"], c: "29242204" },
            { k: ["design pattern", "patterns"], c: "29242205" },
            { k: ["competitive programming", "cp"], c: "29242208" },
            { k: ["proficiency"], c: "29242209" },
            { k: ["macro project", "project-ii"], c: "29242210" },
            { k: ["project management", "economics"], c: "29242211" },
            { k: ["mandatory workshop", "intellectual"], c: "29242212" },
            { k: ["novel engaging", "nec"], c: "NECXXXXX" },
            { k: ["internship", "sip"], c: "SIP2XXXX" }
          ];

          const filtered = allDocs.filter(c => {
            const str = c.subject;
            if (!str) return false;
            const clean = str.trim();
            const lower = clean.toLowerCase();
            const direct = clean.match(/(\d{8}|NECXXXXX|SIP2XXXX)/);
            if (direct) return VALID.includes(direct[0]);
            const m = map.find(x => x.k.some(kw => lower.includes(kw)));
            return m && VALID.includes(m.c);
          });

          console.log("Teacher Dashboard - Filtered Docs:", filtered); // DEBUG LOG
          setClasses(filtered);
          setLoading(false);
        });
        // 2. Assignments
        const unsubAssignments = onSnapshot(collection(db, "assignments"), (snapshot) => {
          setAssignments(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        // 3. Gaps
        const unsubGaps = onSnapshot(collection(db, "learningGaps"), (snapshot) => {
          setGapInsights(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => { unsubClasses(); unsubAssignments(); unsubGaps(); };
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const handleAddClass = async (e) => {
    e.preventDefault();
    if (!user) return;
    setProcessing(true);
    try {
      // AUTO-FORMAT SUBJECT
      const map = [
        { k: ["data science lab", "science lab"], c: "29242206" },
        { k: ["algorithms lab", "algo lab"], c: "29242207" },
        { k: ["data science", "data sci"], c: "29242201" },
        { k: ["design and analysis", "algorithms", "daa", "dsa"], c: "29242202" },
        { k: ["theory of computation", "toc"], c: "29242203" },
        { k: ["communication", "networks", "cn"], c: "29242204" },
        { k: ["design pattern", "patterns"], c: "29242205" },
        { k: ["competitive programming", "cp"], c: "29242208" },
        { k: ["proficiency"], c: "29242209" },
        { k: ["macro project", "project-ii"], c: "29242210" },
        { k: ["project management", "economics"], c: "29242211" },
        { k: ["mandatory workshop", "intellectual"], c: "29242212" },
        { k: ["novel engaging", "nec"], c: "NECXXXXX" },
        { k: ["internship", "sip"], c: "SIP2XXXX" }
      ];
      let finalSubject = newClass.subject.trim();
      const lower = finalSubject.toLowerCase();
      // Try to find code
      const m = map.find(x => x.k.some(kw => lower.includes(kw)));

      let validCode = null;
      if (finalSubject.match(/(\d{8}|NECXXXXX|SIP2XXXX)/)) {
        validCode = finalSubject.match(/(\d{8}|NECXXXXX|SIP2XXXX)/)[0];
      } else if (m) {
        validCode = m.c;
      }

      if (!validCode) {
        alert("Subject Rejected: Must be one of the approved 14 subjects (e.g. Data Science, DAA, TOC).");
        setProcessing(false);
        return;
      }

      if (m && !finalSubject.includes(m.c)) {
        finalSubject = `${m.c} - ${finalSubject}`;
      }

      await addDoc(collection(db, "timetable"), {
        ...newClass,
        subject: finalSubject,
        teacherId: user.uid,
        teacherName: user.displayName || user.email.split('@')[0],
        createdAt: new Date()
      });
      setNewClass({ subject: "", time: "", day: "Monday", room: "", isCancelled: false });
      alert("Class Scheduled Successfully");
    } catch (error) { console.error(error); }
    setProcessing(false);
  };

  const toggleCancel = async (id, status) => {
    try { await updateDoc(doc(db, "timetable", id), { isCancelled: !status }); } catch (e) { }
  };

  const deleteClass = async (id) => {
    if (confirm("Delete this class?")) { try { await deleteDoc(doc(db, "timetable", id)); } catch (e) { } }
  };

  const cardClass = isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200 shadow-sm";
  const textClass = isDark ? "text-white" : "text-gray-900";
  const inputClass = isDark ? "bg-gray-700 border-gray-600 text-white" : "bg-gray-50 border-gray-300 text-gray-900";

  if (loading) return <div className="p-10 text-center animate-pulse">Loading Faculty Dashboard...</div>;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className={`text-3xl font-bold bg-gradient-to-r from-blue-600 to-teal-500 bg-clip-text text-transparent`}>Faculty Dashboard</h1>
        <p className={`mt-1 ${isDark ? "text-gray-400" : "text-gray-600"}`}>Manage your classes and monitor student progress.</p>
      </div>

      {/* Class Manager */}
      <div className={`p-6 rounded-2xl border ${cardClass}`}>
        <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 ${textClass}`}>
          <Clock className="text-blue-500" /> Class Schedule
        </h2>

        <form onSubmit={handleAddClass} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8 pb-8 border-b border-gray-200 dark:border-gray-700">
          <input type="text" placeholder="Subject" required className={`p-3 rounded-xl border ${inputClass}`} value={newClass.subject} onChange={e => setNewClass({ ...newClass, subject: e.target.value })} />
          <input type="text" placeholder="Time (e.g. 10:00 AM)" required className={`p-3 rounded-xl border ${inputClass}`} value={newClass.time} onChange={e => setNewClass({ ...newClass, time: e.target.value })} />
          <input type="text" placeholder="Room" required className={`p-3 rounded-xl border ${inputClass}`} value={newClass.room} onChange={e => setNewClass({ ...newClass, room: e.target.value })} />
          <select className={`p-3 rounded-xl border ${inputClass}`} value={newClass.day} onChange={e => setNewClass({ ...newClass, day: e.target.value })}>
            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <button disabled={processing} className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 font-bold flex justify-center items-center gap-2 shadow-lg shadow-blue-500/20">
            {processing ? <Loader2 className="animate-spin" /> : <Plus size={20} />} Add Class
          </button>
        </form>

        <div className="grid md:grid-cols-3 gap-4">
          {classes.map(cls => (
            <div key={cls.id} className={`p-5 rounded-xl border transition-all ${cls.isCancelled ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-500/30' : cardClass}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className={`font-bold text-lg ${textClass}`}>{cls.subject}</h3>
                  <p className="text-sm opacity-60 flex items-center gap-1 mt-1"><Clock size={14} /> {cls.day} • {cls.time}</p>
                  <p className="text-sm opacity-60 flex items-center gap-1"><MapPin size={14} /> Room {cls.room}</p>
                </div>
                <button onClick={() => deleteClass(cls.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={18} /></button>
              </div>
              {cls.isCancelled && <div className="flex items-center gap-2 text-red-500 text-xs font-bold mb-3"><AlertTriangle size={14} /> CANCELLED</div>}
              <button onClick={() => toggleCancel(cls.id, cls.isCancelled)} className={`w-full py-2 rounded-lg font-bold text-sm border transition-colors ${cls.isCancelled ? 'text-green-600 border-green-200 bg-green-50 hover:bg-green-100' : 'text-red-600 border-red-200 bg-red-50 hover:bg-red-100'}`}>
                {cls.isCancelled ? "Restore Class" : "Cancel Class"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Assignments & Insights */}
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${textClass}`}><ClipboardList className="text-purple-500" /> Assignments</h2>
          <div className="space-y-4">
            {assignments.map((a) => (
              <div key={a.id} className={`p-5 rounded-xl border ${cardClass}`}>
                <h3 className={`font-bold ${textClass}`}>{a.title}</h3>
                <p className="text-sm opacity-60 mb-2">{a.subject}</p>
                <div className="flex justify-between text-sm items-center">
                  <span className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded font-mono text-xs">{a.submissions}/{a.total} Submitted</span>
                  <CheckCircle size={16} className={a.submissions === a.total ? "text-green-500" : "text-gray-300"} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${textClass}`}><TrendingUp className="text-orange-500" /> AI Insights</h2>
          <div className="space-y-3">
            {gapInsights.map((gap) => (
              <div key={gap.id} className={`p-5 rounded-xl border ${cardClass}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className={`font-bold ${textClass}`}>{gap.topic}</h3>
                    <p className="text-sm opacity-60 flex items-center gap-1"><Users size={14} /> {gap.affectedStudents} students struggling</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-bold rounded uppercase ${gap.severity === 'high' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>{gap.severity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashBoard;