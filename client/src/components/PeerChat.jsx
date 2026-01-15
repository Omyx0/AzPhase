import React, { useState, useEffect, useRef } from 'react';
import { Send, X, MessageCircle, MoreVertical } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';

const PeerChat = ({ partner, currentUser, onClose, isDark }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const messagesEndRef = useRef(null);

    // Deterministic Chat ID: Sort UIDs to always get same ID for same pair
    const chatId = [currentUser.uid, partner.userId].sort().join("_");

    useEffect(() => {
        // 1. Ensure Chat Document Exists
        const chatDocRef = doc(db, "chats", chatId);
        setDoc(chatDocRef, {
            users: [currentUser.uid, partner.userId],
            lastUpdated: serverTimestamp()
        }, { merge: true });

        // 2. Listen for Messages
        const q = query(
            collection(db, "chats", chatId, "messages"),
            orderBy("timestamp", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            // Scroll to bottom on new message
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        });

        return () => unsubscribe();
    }, [chatId]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            await addDoc(collection(db, "chats", chatId, "messages"), {
                text: newMessage,
                senderId: currentUser.uid,
                timestamp: serverTimestamp(),
                senderName: currentUser.displayName || "User"
            });

            // Update last updated on parent doc
            setDoc(doc(db, "chats", chatId), {
                lastUpdated: serverTimestamp(),
                lastMessage: newMessage
            }, { merge: true });

            setNewMessage("");
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    const theme = {
        bg: isDark ? "bg-gray-900" : "bg-white",
        headerBg: isDark ? "bg-gray-800 border-gray-700" : "bg-white border-b border-gray-200",
        text: isDark ? "text-white" : "text-gray-900",
        inputBg: isDark ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-900",
        sentBubble: "bg-indigo-600 text-white rounded-br-none",
        receivedBubble: isDark ? "bg-gray-700 text-gray-200 rounded-bl-none" : "bg-gray-100 text-gray-800 rounded-bl-none"
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm sm:items-end sm:justify-end sm:p-0 sm:inset-auto sm:right-4 sm:bottom-0`}>
            <div className={`w-full max-w-md h-[500px] flex flex-col rounded-t-xl sm:rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200 ${theme.bg}`}>

                {/* Header */}
                <div className={`p-4 flex items-center justify-between shadow-sm ${theme.headerBg}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${isDark ? 'bg-indigo-600' : 'bg-indigo-50 text-indigo-600'}`}>
                            {partner.userName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 className={`font-bold text-sm ${theme.text}`}>{partner.userName}</h3>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                <p className="text-xs opacity-70">Study Session Active</p>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-500/10 rounded-full transition-colors">
                        <X size={20} className={theme.text} />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-opacity-50">
                    {messages.length === 0 && (
                        <div className="text-center mt-10 opacity-50 text-sm">
                            <MessageCircle size={32} className="mx-auto mb-2" />
                            <p>Start connecting with {partner.userName}!</p>
                        </div>
                    )}

                    {messages.map((msg) => {
                        const isMe = msg.senderId === currentUser.uid;
                        return (
                            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${isMe ? theme.sentBubble : theme.receivedBubble}`}>
                                    <p>{msg.text}</p>
                                    <p className={`text-[10px] mt-1 opacity-70 text-right`}>
                                        {msg.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSendMessage} className={`p-3 border-t ${isDark ? "border-gray-700 bg-gray-800" : "border-gray-200 bg-white"}`}>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type a message..."
                            className={`flex-1 px-4 py-2.5 rounded-full outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all ${theme.inputBg}`}
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim()}
                            className="p-2.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:scale-95 transition-all shadow-lg shadow-indigo-500/30"
                        >
                            <Send size={18} />
                        </button>
                    </div>
                </form>

            </div>
        </div>
    );
};

export default PeerChat;
