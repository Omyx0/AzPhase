import React, { useState } from 'react';
import { Users, Book } from "lucide-react";

const ClassroomConnect = ({ isDark, userType }) => {
  const [courses, setCourses] = useState([]);
  const [connected, setConnected] = useState(false);

  // Note: Actual fetching requires the OAuth Access Token from login
  // For this demo, we simulate the "Connect" action which would trigger the flow
  const handleConnect = async () => {
     // In a full implementation, you'd use the token from localStorage
     // const token = localStorage.getItem("google_access_token");
     // For now, we simulate a successful sync to show the UI
     setConnected(true);
     setCourses([
         { id: 1, name: "CSD 2nd Year - DBMS", students: 45, role: "TEACHER" },
         { id: 2, name: "Data Structures Lab", students: 42, role: "TEACHER" }
     ]);
  };

  return (
    <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className="flex justify-between items-center mb-6">
         <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {userType === 'teacher' ? 'My Classrooms' : 'Enrolled Courses'}
         </h2>
         {!connected && (
             <button onClick={handleConnect} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700">
                Sync with Google Classroom
             </button>
         )}
      </div>

      {connected ? (
        <div className="space-y-3">
           {courses.map(c => (
             <div key={c.id} className={`flex items-center justify-between p-4 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-green-100 text-green-700 rounded-lg"><Book size={18} /></div>
                   <div>
                      <h4 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{c.name}</h4>
                      <p className="text-xs opacity-60">Section A</p>
                   </div>
                </div>
                {userType === 'teacher' && (
                    <div className="flex items-center gap-1 text-xs font-bold opacity-70">
                       <Users size={14} /> {c.students} Students
                    </div>
                )}
             </div>
           ))}
        </div>
      ) : (
        <div className="text-center py-8 opacity-50">
           <p>Connect your Google account to import {userType === 'teacher' ? 'rosters' : 'classes'}.</p>
        </div>
      )}
    </div>
  );
};

export default ClassroomConnect;