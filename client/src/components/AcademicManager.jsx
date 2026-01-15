import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle, Loader2, Calendar, BookOpen, Award, ExternalLink, RefreshCw } from "lucide-react";
import { db, auth } from '../firebase';
import { doc, setDoc, onSnapshot, getDoc } from "firebase/firestore";

const AcademicManager = ({ isDark }) => {
  const [loading, setLoading] = useState({ timetable: false, syllabus: false, scheme: false });
  const [urls, setUrls] = useState({ timetableUrl: null, syllabusUrl: null, schemeUrl: null });

  // 1. Sync with User Profile (Permanent Memory)
  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = onSnapshot(doc(db, "users", auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        // Handle both nested and flat academicData structure
        if (userData.academicData) {
          const academicData = userData.academicData;
          console.log("📚 Academic Data Loaded:", academicData); // Debug log
          setUrls({
            timetableUrl: academicData.timetableUrl || null,
            syllabusUrl: academicData.syllabusUrl || null,
            schemeUrl: academicData.schemeUrl || null
          });
        } else {
          // Fallback: check for direct properties (backward compatibility)
          console.log("📚 Using fallback structure:", userData); // Debug log
          setUrls({
            timetableUrl: userData.timetableUrl || null,
            syllabusUrl: userData.syllabusUrl || null,
            schemeUrl: userData.schemeUrl || null
          });
        }
      } else {
        console.log("⚠️ User document not found");
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Upload to Cloudinary
  const handleUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(prev => ({ ...prev, [type]: true }));
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const preset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", preset);
      formData.append("folder", `unitime/${auth.currentUser.uid}`);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/upload`, { method: "POST", body: formData });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error.message);

      // 3. Save Link to Firestore (preserve existing academicData)
      const userRef = doc(db, "users", auth.currentUser.uid);
      const userSnap = await getDoc(userRef);
      const existingData = userSnap.exists() ? userSnap.data() : {};
      const existingAcademicData = existingData.academicData || {};
      
      await setDoc(userRef, {
        ...existingData,
        academicData: {
          ...existingAcademicData,
          [`${type}Url`]: data.secure_url,
          [`${type}Name`]: file.name,
          lastUpdated: new Date().toISOString()
        }
      }, { merge: true });

    } catch (err) {
      alert(`Upload Failed: ${err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const theme = {
    card: isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    text: isDark ? 'text-white' : 'text-gray-900',
    btn: isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
  };

  const Card = ({ title, type, icon: Icon, url }) => (
    <div className={`p-5 rounded-xl border transition-all hover:shadow-md ${theme.card}`}>
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2.5 rounded-lg ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-500/10'} text-indigo-500`}>
          <Icon size={20} />
        </div>
        {url && (
          <div className="flex items-center gap-1">
            <CheckCircle className="text-green-500" size={18} />
            <span className="text-xs text-green-500 font-medium">Linked</span>
          </div>
        )}
      </div>
      <h3 className={`font-bold mb-1 ${theme.text}`}>{title}</h3>
      <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        {url ? "Document Linked" : "No document uploaded"}
      </p>
      
      {url ? (
        <div className="flex gap-2">
          <a 
            href={url} 
            target="_blank" 
            rel="noreferrer" 
            className={`flex-1 py-2 text-xs font-semibold text-center rounded-lg transition-all ${theme.btn} hover:opacity-80 flex items-center justify-center gap-1`}
          >
            <ExternalLink size={14} />
            View
          </a>
          <label className={`px-3 py-2 cursor-pointer rounded-lg transition-all ${theme.btn} hover:opacity-80 flex items-center justify-center`}>
             <input type="file" hidden onChange={(e) => handleUpload(e, type)} accept=".pdf,.png,.jpg,.jpeg" />
             {loading[type] ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </label>
        </div>
      ) : (
        <label className={`flex items-center justify-center w-full py-2.5 border-2 border-dashed rounded-lg cursor-pointer transition-all text-xs font-semibold ${
          isDark 
            ? 'border-gray-600 text-gray-400 hover:border-indigo-500 hover:text-indigo-400' 
            : 'border-gray-300 text-gray-500 hover:border-indigo-500 hover:text-indigo-500'
        }`}>
           <input type="file" hidden onChange={(e) => handleUpload(e, type)} accept=".pdf,.png,.jpg,.jpeg" />
           {loading[type] ? (
             <Loader2 size={14} className="animate-spin" />
           ) : (
             <>
               <Upload size={14} className="mr-2" />
               Upload PDF
             </>
           )}
        </label>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card title="Timetable" type="timetable" icon={Calendar} url={urls.timetableUrl} />
      <Card title="Syllabus" type="syllabus" icon={BookOpen} url={urls.syllabusUrl} />
      <Card title="Marking Scheme" type="scheme" icon={Award} url={urls.schemeUrl} />
    </div>
  );
};

export default AcademicManager;