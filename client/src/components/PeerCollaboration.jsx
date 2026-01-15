import React, { useState, useEffect } from 'react';
import { Users, Clock, BookOpen, MessageCircle, Send, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { findStudyPartners } from '../utils/peerCollaborationMatcher';

import PeerChat from './PeerChat';

const PeerCollaboration = ({ isDark, classes }) => {
  const [matches, setMatches] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [userClassesMap, setUserClassesMap] = useState({});
  const [loading, setLoading] = useState(true);

  // Request States
  const [sentRequests, setSentRequests] = useState({}); // { receiverId: status }
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [acceptedIncoming, setAcceptedIncoming] = useState({});
  const [requestLoading, setRequestLoading] = useState(false);
  const [activeChatPartner, setActiveChatPartner] = useState(null);

  // ... (existing useEffects) ...

  // 1. Fetch Users & Classes (Existing Logic)
  useEffect(() => {
    if (!auth.currentUser || !classes) return;

    const usersQuery = query(collection(db, "users"));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllUsers(users);

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

  // 2. Fetch Requests (Real-time)
  useEffect(() => {
    if (!auth.currentUser) return;

    // Outgoing Requests
    const outgoingq = query(
      collection(db, "study_requests"),
      where("fromUser.uid", "==", auth.currentUser.uid)
    );

    // Incoming Requests
    const incomingq = query(
      collection(db, "study_requests"),
      where("toUser.uid", "==", auth.currentUser.uid)
      // Removed status filter to avoid composite index requirements
    );

    const unsubOutgoing = onSnapshot(outgoingq, (snap) => {
      console.log("Outgoing Requests Snap:", snap.size);
      const map = {};
      snap.docs.forEach(d => {
        const data = d.data();
        map[data.toUser.uid] = data.status;
      });
      setSentRequests(map);
    });

    const unsubIncoming = onSnapshot(incomingq, (snap) => {
      console.log("Incoming Requests Snap:", snap.size);

      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 1. Pending for UI list
      const pending = docs.filter(req => req.status === "pending");
      setIncomingRequests(pending);

      // 2. Accepted for connection check
      const accepted = {};
      docs.filter(req => req.status === "accepted").forEach(req => {
        accepted[req.fromUser.uid] = "accepted";
      });
      setAcceptedIncoming(accepted);
    });

    return () => { unsubOutgoing(); unsubIncoming(); };
  }, [auth.currentUser]);

  // 3. Match Logic
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

  // --- HANDLERS ---
  // --- HANDLERS ---
  const handleSendRequest = async (match) => {
    setRequestLoading(true);
    try {
      // Check if already sent (optimistic check)
      if (sentRequests[match.userId]) return;

      await addDoc(collection(db, "study_requests"), {
        fromUser: {
          uid: auth.currentUser.uid,
          name: auth.currentUser.displayName || auth.currentUser.email,
          email: auth.currentUser.email
        },
        toUser: {
          uid: match.userId,
          name: match.userName,
          email: match.userEmail
        },
        status: "pending",
        timestamp: serverTimestamp()
      });
      // alert("Request sent!");
    } catch (error) {
      console.error("Error sending request:", error);
      alert("Failed to send request.");
    } finally {
      setRequestLoading(false);
    }
  };

  const handleAccept = async (reqId) => {
    try {
      await updateDoc(doc(db, "study_requests", reqId), {
        status: "accepted"
      });
    } catch (error) {
      console.error("Error accepting:", error);
    }
  };

  const handleReject = async (reqId) => {
    try {
      await deleteDoc(doc(db, "study_requests", reqId));
    } catch (error) {
      console.error("Error rejecting:", error);
    }
  };

  const theme = {
    card: isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200",
    text: isDark ? "text-white" : "text-gray-900",
    muted: isDark ? "text-gray-400" : "text-gray-600",
    bg: isDark ? "bg-gray-900" : "bg-gray-50",
    successBg: isDark ? "bg-green-900/30 border-green-800" : "bg-green-50 border-green-200",
    successText: isDark ? "text-green-300" : "text-green-700"
  };

  if (loading) {
    return (
      <div className={`p-6 rounded-xl border ${theme.card}`}>
        <div className={`text-center ${theme.text} flex flex-col items-center gap-2`}>
          <Loader2 className="animate-spin text-indigo-500" />
          Loading collaboration matches...
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 rounded-xl border ${theme.card} space-y-8`}>

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-indigo-500" />
          <h2 className={`text-xl font-bold ${theme.text}`}>Study Partners</h2>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
          {matches.length} Potential Partners
        </div>
      </div>

      {/* CHAT OVERLAY */}
      {activeChatPartner && (
        <PeerChat
          partner={activeChatPartner}
          currentUser={auth.currentUser}
          isDark={isDark}
          onClose={() => setActiveChatPartner(null)}
        />
      )}

      {/* INCOMING REQUESTS SECTION */}
      {incomingRequests.length > 0 && (
        <div className={`p-4 rounded-lg border ${theme.successBg}`}>
          <h3 className={`text-sm font-bold mb-3 flex items-center gap-2 ${theme.successText}`}>
            <MessageCircle className="w-4 h-4" /> Incoming Requests
          </h3>
          <div className="space-y-3">
            {incomingRequests.map(req => (
              <div key={req.id} className={`p-3 rounded-md bg-white/50 backdrop-blur-sm border border-green-100 dark:border-green-800/50 flex justify-between items-center`}>
                <div>
                  <p className={`font-semibold text-sm ${theme.text}`}>{req.fromUser.name}</p>
                  <p className={`text-xs ${theme.muted}`}>wants to study with you</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(req.id)}
                    className="p-1.5 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                    title="Accept"
                  >
                    <CheckCircle size={16} />
                  </button>
                  <button
                    onClick={() => handleReject(req.id)}
                    className="p-1.5 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    title="Reject"
                  >
                    <XCircle size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MATCHES LIST */}
      {matches.length === 0 ? (
        <div className={`text-center py-8 ${theme.muted}`}>
          <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No study partners available right now.</p>
          <p className="text-sm mt-2">Check back when you have free time slots!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.slice(0, 5).map((match, index) => {
            const outgoingStatus = sentRequests[match.userId];
            const incomingStatus = acceptedIncoming[match.userId];
            const isConnected = outgoingStatus === 'accepted' || incomingStatus === 'accepted';
            const isPending = outgoingStatus === 'pending';

            return (
              <div
                key={match.userId}
                className={`p-4 rounded-lg border transition-all ${isConnected
                  ? isDark ? 'bg-green-900/10 border-green-700/50' : 'bg-green-50 border-green-200'
                  : isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                  }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${isDark ? 'bg-indigo-600' : 'bg-indigo-500 text-white'
                        }`}>
                        {match.userName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className={`font-semibold ${theme.text}`}>{match.userName}</p>
                        <p className={`text-xs ${theme.muted}`}>{match.userEmail}</p>
                      </div>
                    </div>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-semibold ${match.matchScore > 30
                    ? isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                    : isDark ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                    {match.matchScore}% Match
                  </div>
                </div>

                {/* OVERLAPPING DETAILS (Only show if not connected for brevity, or keep showing?) --> Keeping for context */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {match.overlappingSlots.length > 0 && (
                    <div className={`text-xs p-2 rounded ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                      <div className="flex items-center gap-1 mb-1 font-semibold opacity-70">
                        <Clock size={12} /> Free Together
                      </div>
                      {match.overlappingSlots.slice(0, 1).map((s, i) => (
                        <div key={i}>{s.startTime} ({s.duration}m)</div>
                      ))}
                    </div>
                  )}
                  {match.subjectOverlap.length > 0 && (
                    <div className={`text-xs p-2 rounded ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
                      <div className="flex items-center gap-1 mb-1 font-semibold opacity-70">
                        <BookOpen size={12} /> Subjects
                      </div>
                      <div className="truncate">{match.subjectOverlap.join(', ')}</div>
                    </div>
                  )}
                </div>

                {/* ACTION BUTTON */}
                {isConnected ? (
                  <button
                    onClick={() => setActiveChatPartner(match)}
                    className={`w-full px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${isDark ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-green-500 hover:bg-green-600 text-white shadow-sm'
                      }`}
                  >
                    <MessageCircle className="w-4 h-4" />
                    Connected • Chat Now
                  </button>
                ) : (
                  <button
                    onClick={() => handleSendRequest(match)}
                    disabled={isPending || requestLoading}
                    className={`w-full px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${isPending
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : isDark
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200'
                      }`}
                  >
                    {isPending ? (
                      <>
                        <Clock className="w-4 h-4 animate-pulse" /> Request Sent
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" /> Send Study Request
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PeerCollaboration;
