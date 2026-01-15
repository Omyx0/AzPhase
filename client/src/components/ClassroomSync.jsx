import React, { useState } from 'react';
import { Users, Book, RefreshCw, Loader2 } from "lucide-react";
import { auth } from '../firebase';

const ClassroomSync = ({ isDark }) => {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);

  const handleSync = async () => {
    setLoading(true);
    setError(null);
    
    // NOTE: In a real app, you would use the Google Classroom API here.
    // Since we are simulating the connection for now to prevent complex OAuth setup errors:
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const user = auth.currentUser;
      if (!user) throw new Error("Please login to sync.");

      // Mock Data (Replace this with real API call later if needed)
      const mockCourses = [
        { id: "c1", name: "CSD 2nd Year - DBMS", section: "Section A", role: "STUDENT" },
        { id: "c2", name: "Data Structures Lab", section: "Lab G1", role: "STUDENT" },
        { id: "c3", name: "Software Engineering", section: "Theory", role: "STUDENT" }
      ];

      setCourses(mockCourses);
      setConnected(true);
    } catch (err) {
      console.error(err);
      setError("Failed to sync with Google Classroom. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const theme = {
    card: isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200",
    text: isDark ? "text-white" : "text-gray-900",
    subText: isDark ? "text-gray-400" : "text-gray-500",
  };

  return (
    <div className={`p-6 rounded-xl border ${theme.card}`}>
      <div className="flex justify-between items-center mb-4">
         <div className="flex items-center gap-2">
            <div className="p-2 bg-green-100 text-green-700 rounded-lg">
                <Users size={20} />
            </div>
            <div>
                <h2 className={`text-lg font-bold ${theme.text}`}>Google Classroom</h2>
                <p className={`text-xs ${theme.subText}`}>Sync your enrolled courses</p>
            </div>
         </div>
         
         <button 
            onClick={handleSync} 
            disabled={loading || connected}
            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${
                connected 
                ? "bg-green-100 text-green-700 cursor-default" 
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
         >
            {loading ? <Loader2 className="animate-spin w-4 h-4" /> : connected ? "Synced" : "Sync Now"}
         </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      <div className="space-y-3">
         {courses.length > 0 ? (
            courses.map(course => (
                <div key={course.id} className={`flex items-center justify-between p-3 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-100'}`}>
                    <div className="flex items-center gap-3">
                        <Book className={`w-4 h-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                        <div>
                            <h4 className={`text-sm font-semibold ${theme.text}`}>{course.name}</h4>
                            <p className="text-xs opacity-60">{course.section}</p>
                        </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 bg-gray-200 text-gray-700 rounded uppercase">
                        {course.role}
                    </span>
                </div>
            ))
         ) : (
            <div className={`text-center py-6 border-2 border-dashed rounded-lg ${isDark ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400'}`}>
                <p className="text-sm">No courses synced yet.</p>
            </div>
         )}
      </div>
    </div>
  );
};

export default ClassroomSync;