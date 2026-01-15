/**
 * Smart Peer Collaboration Component
 * Shows matched study partners and collaboration opportunities
 */

import React, { useState, useEffect } from 'react';
import { Users, Clock, BookOpen, MessageCircle, Send, AlertCircle } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { findStudyPartners, checkRealTimeAvailability } from '../utils/peerCollaborationMatcher';

const PeerCollaboration = ({ isDark, classes }) => {
  const [matches, setMatches] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [userClassesMap, setUserClassesMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser || !classes) return;

    // Fetch all users
    const usersQuery = query(collection(db, "users"));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllUsers(users);

      // Fetch classes for each user
      const classPromises = users.map(user =>
        getDoc(doc(db, "timetable", user.id)).catch(() => null)
      );

      Promise.all(classPromises).then(classDocs => {
        const classesMap = {};
        classDocs.forEach((classDoc, index) => {
          if (classDoc && classDoc.exists()) {
            classesMap[users[index].id] = [classDoc.data()];
          }
        });

        // Also get from timetable collection
        const timetableQuery = query(collection(db, "timetable"));
        onSnapshot(timetableQuery, (timetableSnapshot) => {
          const allTimetableClasses = timetableSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          const timetableMap = {};
          allTimetableClasses.forEach(cls => {
            const userId = cls.userId || cls.teacherId;
            if (userId) {
              if (!timetableMap[userId]) timetableMap[userId] = [];
              timetableMap[userId].push(cls);
            }
          });

          setUserClassesMap({ ...classesMap, ...timetableMap });
          setLoading(false);
        });
      });
    });

    return () => unsubscribeUsers();
  }, [auth.currentUser, classes]);

  useEffect(() => {
    if (!auth.currentUser || allUsers.length === 0 || !classes) return;

    const loadMatches = async () => {
      const foundMatches = await findStudyPartners(
        auth.currentUser.uid,
        allUsers,
        classes,
        userClassesMap
      );
      setMatches(foundMatches);
    };

    loadMatches();
  }, [auth.currentUser, allUsers, classes, userClassesMap]);

  const theme = {
    card: isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200",
    text: isDark ? "text-white" : "text-gray-900",
    muted: isDark ? "text-gray-400" : "text-gray-600",
    bg: isDark ? "bg-gray-900" : "bg-gray-50"
  };

  if (loading) {
    return (
      <div className={`p-6 rounded-xl border ${theme.card}`}>
        <div className={`text-center ${theme.text}`}>Loading collaboration matches...</div>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-xl border ${theme.card}`}>
      <div className="flex items-center gap-3 mb-6">
        <Users className="w-6 h-6 text-indigo-500" />
        <h2 className={`text-xl font-bold ${theme.text}`}>Study Partners</h2>
      </div>

      {matches.length === 0 ? (
        <div className={`text-center py-8 ${theme.muted}`}>
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No study partners available right now.</p>
          <p className="text-sm mt-2">Check back when you have free time slots!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.slice(0, 5).map((match, index) => (
            <div
              key={match.userId}
              className={`p-4 rounded-lg border ${
                isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      isDark ? 'bg-indigo-600' : 'bg-indigo-500 text-white'
                    }`}>
                      {match.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className={`font-semibold ${theme.text}`}>{match.userName}</p>
                      <p className={`text-xs ${theme.muted}`}>{match.userEmail}</p>
                    </div>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded-full text-xs font-semibold ${
                  match.matchScore > 30
                    ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                    : isDark ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  Match: {match.matchScore}%
                </div>
              </div>

              {/* Overlapping Free Time */}
              {match.overlappingSlots.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    <span className={`text-xs font-semibold ${theme.text}`}>Available Together</span>
                  </div>
                  {match.overlappingSlots.slice(0, 2).map((slot, idx) => (
                    <div key={idx} className={`text-xs ${theme.muted} mb-1 ml-6`}>
                      {slot.startTime} ({slot.duration} min)
                    </div>
                  ))}
                </div>
              )}

              {/* Subject Overlap */}
              {match.subjectOverlap.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="w-4 h-4 text-indigo-500" />
                    <span className={`text-xs font-semibold ${theme.text}`}>Common Subjects</span>
                  </div>
                  <div className="flex flex-wrap gap-1 ml-6">
                    {match.subjectOverlap.map((subject, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 rounded text-xs ${
                          isDark ? 'bg-indigo-900/30 text-indigo-300' : 'bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {subject}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Collaboration Modes */}
              {match.collaborationModes.length > 0 && (
                <div className="mb-3">
                  <span className={`text-xs font-semibold ${theme.text}`}>Suggested Activities:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {match.collaborationModes.slice(0, 2).map((mode, idx) => (
                      <button
                        key={idx}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                          mode.priority === 'high'
                            ? isDark
                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            : isDark
                            ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                      >
                        <MessageCircle className="w-3 h-3" />
                        {mode.mode.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact Button */}
              <button
                className={`w-full mt-3 px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
                  isDark
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                <Send className="w-4 h-4" />
                Contact for Study Session
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PeerCollaboration;
