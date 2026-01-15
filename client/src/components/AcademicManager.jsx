import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle, Loader2, Calendar, BookOpen, Award, ExternalLink, RefreshCw, Zap } from "lucide-react";
import { db, auth } from '../firebase';
import { doc, setDoc, onSnapshot, getDoc, collection, writeBatch } from "firebase/firestore";
import { GoogleGenerativeAI } from "@google/generative-ai";

const AcademicManager = ({ isDark }) => {
  const [loading, setLoading] = useState({ timetable: false, syllabus: false, scheme: false });
  const [urls, setUrls] = useState({ timetableUrl: null, syllabusUrl: null, schemeUrl: null });
  const [parsingStatus, setParsingStatus] = useState(null); // 'scanning', 'success', 'error'

  // 1. Sync with User Profile (Permanent Memory)
  useEffect(() => {
    if (!auth.currentUser) return;
    const unsubscribe = onSnapshot(doc(db, "users", auth.currentUser.uid), (docSnap) => {
      if (docSnap.exists()) {
        const userData = docSnap.data();
        // Handle both nested and flat academicData structure
        if (userData.academicData) {
          const academicData = userData.academicData;
          setUrls({
            timetableUrl: academicData.timetableUrl || null,
            syllabusUrl: academicData.syllabusUrl || null,
            schemeUrl: academicData.schemeUrl || null
          });
        } else {
          // Fallback: check for direct properties (backward compatibility)
          setUrls({
            timetableUrl: userData.timetableUrl || null,
            syllabusUrl: userData.syllabusUrl || null,
            schemeUrl: userData.schemeUrl || null
          });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // --- AI SCAN TIMETABLE ---
  // --- AI SCAN TIMETABLE ---
  const scanTimetable = async (file) => {
    setParsingStatus('scanning');
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      const genAI = new GoogleGenerativeAI(apiKey);

      // List of models to try in order of preference/stability
      const modelsToTry = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
      let model = null;
      let activeModelName = "";

      // Attempt to initialize a working model
      for (const modelName of modelsToTry) {
        try {
          // Just getting the model instance doesn't validate it, 
          // but we prepare it here. Validation happens on generateContent.
          const m = genAI.getGenerativeModel({ model: modelName });
          if (m) {
            model = m;
            activeModelName = modelName;
            break;
          }
        } catch (e) {
          console.warn(`Model ${modelName} failed init`, e);
        }
      }

      if (!model) throw new Error("No Gemini models available.");

      // Convert local file to base64
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
      });

      const prompt = `Analyze this timetable document. Extract the class schedule into a structured JSON array.
        Format: [{ "day": "Monday", "time": "10:00 AM - 11:00 AM", "subject": "Maths", "room": "GB-201", "attended": false, "isCancelled": false }].
        Rules:
        1. Ignore breaks/lunch.
        2. Use full day names (Monday, Tuesday...).
        3. Infer time ranges if row headers imply them.
        4. If subject is unclear, use 'General Lecture'.
        5. Return ONLY the JSON string, no markdown code blocks.`;

      // Attempt generation with fallback logic for 404/429
      let result = null;
      try {
        result = await model.generateContent([
          prompt,
          { inlineData: { data: base64Data, mimeType: file.type } }
        ]);
      } catch (genError) {
        console.warn(`Primary model ${activeModelName} failed:`, genError);
        // If 404 or 429, try the secondary model if available and different
        if ((genError.message.includes("404") || genError.message.includes("429")) && activeModelName !== "gemini-2.5-flash-lite") {
          console.log("Retrying with gemini-2.5-flash-lite...");
          const fallback = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
          result = await fallback.generateContent([
            prompt,
            { inlineData: { data: base64Data, mimeType: file.type } }
          ]);
        } else {
          throw genError;
        }
      }

      const responseText = result.response.text();
      const jsonStr = responseText.replace(/```json|```/g, '').trim();
      const schedule = JSON.parse(jsonStr);

      console.log("Parsed Schedule:", schedule);

      if (Array.isArray(schedule) && schedule.length > 0) {
        const batch = writeBatch(db);
        schedule.forEach((cls) => {
          const docRef = doc(collection(db, "timetable"));
          batch.set(docRef, {
            userId: auth.currentUser.uid,
            day: cls.day || "Monday",
            time: cls.time || "09:00 AM",
            subject: cls.subject || "Study Session",
            room: cls.room || "Home",
            attended: false,
            isCancelled: false,
            timestamp: new Date().toISOString()
          });
        });

        await batch.commit();
        setParsingStatus('success');
        setTimeout(() => setParsingStatus(null), 3000);
      } else {
        throw new Error("No classes found in analysis.");
      }

    } catch (error) {
      console.error("Scanning Error:", error);
      setParsingStatus('error');
      // Handle Rate Limit specifically
      if (error.message.includes("429") || error.message.includes("Quota")) {
        alert("AI Usage Limit Reached. Please try again in 1 minute.");
      } else if (error.message.includes("404")) {
        alert("AI Model not available. Please check API settings.");
      } else {
        alert(`Failed to scan timetable: ${error.message}. Manual entry might be required.`);
      }
      setTimeout(() => setParsingStatus(null), 3000);
    }
  };

  // 2. Upload to Cloudinary
  const handleUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(prev => ({ ...prev, [type]: true }));

    // Trigger AI Scan immediately for Timetables
    if (type === 'timetable') {
      scanTimetable(file);
    }
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

      const updateData = {
        ...existingData,
        academicData: {
          ...existingAcademicData,
          [`${type}Url`]: data.secure_url,
          [`${type}Name`]: file.name,
          lastUpdated: new Date().toISOString()
        }
      };

      await setDoc(userRef, updateData, { merge: true });

      // If Timetable, Trigger Smart Scan
      if (type === 'timetable') {
        scanTimetable(file); // Call without await to not block UI, or await if you want
      }

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
    <div className={`p-5 rounded-xl border transition-all hover:shadow-md ${theme.card} relative overflow-hidden`}>
      {/* Scanning Overlay */}
      {type === 'timetable' && parsingStatus === 'scanning' && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-white">
          <RefreshCw className="w-8 h-8 animate-spin mb-2 text-indigo-400" />
          <p className="text-sm font-semibold">AI Scanning...</p>
        </div>
      )}
      {type === 'timetable' && parsingStatus === 'success' && (
        <div className="absolute inset-0 bg-green-900/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-white">
          <CheckCircle className="w-8 h-8 mb-2 text-green-400" />
          <p className="text-sm font-semibold">Imported!</p>
        </div>
      )}

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
        <label className={`flex items-center justify-center w-full py-2.5 border-2 border-dashed rounded-lg cursor-pointer transition-all text-xs font-semibold ${isDark
          ? 'border-gray-600 text-gray-400 hover:border-indigo-500 hover:text-indigo-400'
          : 'border-gray-300 text-gray-500 hover:border-indigo-500 hover:text-indigo-500'
          }`}>
          <input type="file" hidden onChange={(e) => handleUpload(e, type)} accept=".pdf,.png,.jpg,.jpeg" />
          {loading[type] ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <>
              <Upload size={14} className="mr-2" />
              Upload {title}
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