import React, { useState, useEffect, useRef } from "react";
import { Send, Bot, User, Loader2, AlertCircle } from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";

const Chatbot = ({ isDark }) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      text: "Hello! I'm UniTime AI, your academic assistant. Ask me about study plans, schedules, or anything to boost your productivity! 🎓",
      sender: "ai"
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(false);

  const messagesEndRef = useRef(null);
  const genAIRef = useRef(null);

  // Initialize Google Generative AI
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      console.error("❌ VITE_GEMINI_API_KEY is not set in .env.local");
      setApiError(true);
      setMessages((prev) => [...prev, {
        text: "⚠️ API key not configured. Please set VITE_GEMINI_API_KEY in your .env.local file.",
        sender: "error"
      }]);
      return;
    }

    genAIRef.current = new GoogleGenerativeAI(apiKey);
    console.log("✅ Gemini AI initialized successfully");
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages, loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading || !genAIRef.current) return;

    // 1. Add user message
    const userMessage = { text: input, sender: "user" };
    setMessages((prev) => [...prev, userMessage]);

    // Clear input and start loading
    const userInput = input;
    setInput("");
    setLoading(true);
    setApiError(false);

    try {
      // 2. Initialize the model - using valid stable models with fallback
      // Updated based on API key availability - only 2.5 models work
      const modelCandidates = [
        "gemini-2.5-flash",        // Stable, fast, production-ready
        "gemini-2.5-flash-lite"    // Stable, faster, cost-efficient
      ];

      let model;
      let modelName;
      for (const candidate of modelCandidates) {
        try {
          model = genAIRef.current.getGenerativeModel({
            model: candidate,
            generationConfig: {
              maxOutputTokens: 1024,
              temperature: 0.7,
            }
          });
          modelName = candidate;
          break;
        } catch (error) {
          console.log(`Model ${candidate} not available, trying next...`);
        }
      }

      if (!model) {
        throw new Error("No valid Gemini model available");
      }

      // 3. Create a system prompt for UniTime AI persona
      const systemPrompt = `You are UniTime AI, a helpful and motivating academic assistant for students and teachers. Your role is to help with:
- Study planning and time management
- Schedule organization
- Motivation and academic guidance
- Quick tips and productivity advice

Keep responses concise (2-3 sentences), friendly, and motivating. If asked about something unrelated to academics, politely redirect to academic topics.`;

      // 4. Send message to Gemini API
      const fullPrompt = `${systemPrompt}\n\nUser: ${userInput}`;

      let retryCount = 0;
      const maxRetries = 3;
      let result;

      // Retry logic for rate limiting
      while (retryCount < maxRetries) {
        try {
          result = await model.generateContent(fullPrompt);
          console.log(`✅ Successfully used model: ${modelName}`);
          break; // Success, exit retry loop
        } catch (error) {
          if (error.message.includes("429") && retryCount < maxRetries - 1) {
            // Rate limited - wait and retry
            const waitTime = Math.pow(2, retryCount) * 5000; // 5s, 10s, 20s
            console.log(`Rate limited. Retrying in ${waitTime / 1000}s...`);
            setMessages((prev) => [...prev, {
              text: `API rate limited. Retrying in ${waitTime / 1000}s...`,
              sender: "ai"
            }]);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            retryCount++;
          } else {
            throw error; // Not rate limited or max retries reached
          }
        }
      }

      const responseText = result.response.text();

      // 5. Add AI response to messages
      const aiMessage = {
        text: responseText || "Sorry, I couldn't generate a response. Please try again.",
        sender: "ai"
      };
      setMessages((prev) => [...prev, aiMessage]);

    } catch (error) {
      console.error("❌ Chat Error:", error);

      let errorMessage = "Oops! Something went wrong. Please try again.";

      if (error.message.includes("429")) {
        errorMessage = "⏱️ Free tier quota exceeded. Please upgrade to a paid plan at https://console.cloud.google.com/billing/overview or wait until tomorrow for the quota to reset.";
      } else if (error.message.includes("404") || error.message.includes("not found") || error.message.includes("No valid Gemini model")) {
        errorMessage = "❌ Invalid Gemini model. Please check your API key and ensure you have access to Gemini models.";
      } else if (error.message.includes("API key") || error.message.includes("401") || error.message.includes("403")) {
        errorMessage = "❌ API key error. Please check your VITE_GEMINI_API_KEY configuration.";
      } else if (error.message.includes("network")) {
        errorMessage = "🌐 Network error. Please check your internet connection.";
      }

      setMessages((prev) => [...prev, { text: errorMessage, sender: "error" }]);
      setApiError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex flex-col h-[500px] w-full max-w-md mx-auto rounded-2xl shadow-2xl overflow-hidden border ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>

      {/* Header */}
      <div className="bg-indigo-600 p-4 flex items-center gap-3">
        <div className="p-2 bg-white/20 rounded-full">
          <Bot className="text-white w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-white text-lg">UniTime AI</h3>
          <p className={`text-indigo-200 text-xs flex items-center gap-1 ${apiError ? 'text-red-300' : ''}`}>
            <span className={`w-2 h-2 rounded-full animate-pulse ${apiError ? 'bg-red-400' : 'bg-green-400'}`}></span>
            {apiError ? 'Offline' : 'Online'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isDark ? "bg-gray-900" : "bg-gray-50"}`}>
        {messages.map((msg, index) => (
          <div key={index} className={`flex w-full ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
            {msg.sender !== "user" && (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 flex-shrink-0 border ${isDark ? "bg-indigo-900/30 border-indigo-700/50" : "bg-white border-indigo-100 shadow-sm"}`}>
                {msg.sender === "error" ? (
                  <AlertCircle size={16} className="text-red-500" />
                ) : (
                  <Bot size={18} className="text-indigo-600" />
                )}
              </div>
            )}
            <div className={`max-w-[80%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.sender === "user"
                ? "bg-indigo-600 text-white rounded-br-none"
                : msg.sender === "error"
                  ? "bg-red-50 text-red-700 border border-red-200 rounded-bl-none"
                  : isDark ? "bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700" : "bg-white text-gray-800 rounded-bl-none border border-gray-100"
              }`}>
              {msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start items-center w-full">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 flex-shrink-0 border ${isDark ? "bg-indigo-900/30 border-indigo-700/50" : "bg-white border-indigo-100 shadow-sm"}`}>
              <Bot size={18} className="text-indigo-600" />
            </div>
            <div className={`px-4 py-2 rounded-full flex items-center gap-2 text-xs font-medium ${isDark ? "bg-gray-800 text-gray-400" : "bg-white text-gray-500 shadow-sm border border-gray-100"}`}>
              <Loader2 className="w-3 h-3 animate-spin text-indigo-500" /> Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`p-3 border-t flex gap-2 ${isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}`}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your schedule..."
          className={`flex-1 text-sm px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all ${isDark ? "bg-gray-900 text-white placeholder-gray-500" : "bg-gray-100 text-gray-800 placeholder-gray-400"}`}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          disabled={loading || apiError}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim() || apiError}
          className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/30"
          title={apiError ? "API not configured" : "Send message"}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default Chatbot;