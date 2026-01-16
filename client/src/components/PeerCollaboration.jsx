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

  // 1. Fetch ONLINE Users (Real-Time Presence)
  useEffect(() => {
    if (!auth.currentUser) return;

    // Query users who have been active recently
    // Note: Firestore requires composite index for multiple fields. 
    // We will fetch recent users and filter client-side for simplicity if index is missing.
    const usersQuery = query(
      collection(db, "users"),
      // orderBy("lastSeen", "desc"), // simple ordering
      // limit(50)
    );

    const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
      const now = new Date();
      const onlineThreshold = 5 * 60 * 1000; // 5 minutes

      const activeUsers = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => {
          // Filter out current user
          if (user.id === auth.currentUser.uid) return false;

          // Check if online or lastSeen is recent
          if (user.isOnline) return true;
          if (user.lastSeen?.toDate) {
            const diff = now - user.lastSeen.toDate();
            return diff < onlineThreshold;
          }
          return false;
        });

      // Transform to match existing UI structure (userName, userEmail, etc.)
      const formattedMatches = activeUsers.map(u => ({
        userId: u.id,
        userName: u.name || u.email.split('@')[0], // Fallback name
        userEmail: u.email,
        // Random or basic match score for visual consistency if needed, else hide it
        matchScore: 100
      }));

      setMatches(formattedMatches);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  // 2. Fetch Requests (Real-time) - KEPT SAME
  useEffect(() => {
    if (!auth.currentUser) return;

    const outgoingq = query(
      collection(db, "study_requests"),
      where("fromUser.uid", "==", auth.currentUser.uid)
    );

    const incomingq = query(
      collection(db, "study_requests"),
      where("toUser.uid", "==", auth.currentUser.uid)
    );

    const unsubOutgoing = onSnapshot(outgoingq, (snap) => {
      const map = {};
      snap.docs.forEach(d => {
        const data = d.data();
        map[data.toUser.uid] = data.status;
      });
      setSentRequests(map);
    });

    const unsubIncoming = onSnapshot(incomingq, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setIncomingRequests(docs.filter(req => req.status === "pending"));

      const accepted = {};
      docs.filter(req => req.status === "accepted").forEach(req => {
        accepted[req.fromUser.uid] = "accepted";
      });
      setAcceptedIncoming(accepted);
    });

    return () => { unsubOutgoing(); unsubIncoming(); };
  }, [auth.currentUser]);

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

      {/* MATCHES LIST - Simple List View */}
      {matches.length === 0 ? (
        <div className={`text-center py-8 ${theme.muted}`}>
          <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No study partners found.</p>
        </div>
      ) : (
        <div className={`rounded-xl border ${theme.card} overflow-hidden`}>
          <div className="p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className={`font-bold text-lg ${theme.text}`}>Available Students</h3>
            <p className={`text-xs ${theme.muted}`}>{matches.length} students active now</p>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {matches.map((match, index) => {
              const outgoingStatus = sentRequests[match.userId];
              const incomingStatus = acceptedIncoming[match.userId];
              const isConnected = outgoingStatus === 'accepted' || incomingStatus === 'accepted';
              const isPending = outgoingStatus === 'pending';

              return (
                <div
                  key={match.userId}
                  className={`p-4 flex items-center justify-between transition-all hover:bg-gray-50 dark:hover:bg-gray-800/50`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${isDark ? 'bg-indigo-600' : 'bg-indigo-500 text-white'}`}>
                      {match.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className={`font-semibold text-sm ${theme.text}`}>{match.userName}</p>
                      <p className={`text-xs ${theme.muted}`}>{match.userEmail}</p>
                    </div>
                  </div>

                  {/* ACTION BUTTON */}
                  <div>
                    {isConnected ? (
                      <button
                        onClick={() => setActiveChatPartner(match)}
                        className={`p-2 rounded-full transition-all ${isDark ? 'text-green-400 hover:bg-green-900/30' : 'text-green-600 hover:bg-green-50'}`}
                        title="Chat"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSendRequest(match)}
                        disabled={isPending || requestLoading}
                        className={`p-2 rounded-full transition-all ${isPending
                          ? 'text-gray-400 cursor-not-allowed'
                          : isDark
                            ? 'text-indigo-400 hover:bg-indigo-900/30'
                            : 'text-indigo-600 hover:bg-indigo-50'
                          }`}
                        title="Connect"
                      >
                        {isPending ? (
                          <Clock className="w-5 h-5 animate-pulse" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PeerCollaboration;
