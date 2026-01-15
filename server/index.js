const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { v2: cloudinary } = require('cloudinary');
const { Readable } = require('stream');

// --- 1. ROBUST PDF LIBRARY LOADING (Your Code) ---
let pdfParseLib;
try {
    pdfParseLib = require('pdf-parse');
} catch (e) {
    console.warn("⚠️ Warning: 'pdf-parse' not found. PDF reading will be skipped.");
}
const pdfParse = (pdfParseLib && typeof pdfParseLib === 'function') 
    ? pdfParseLib 
    : (pdfParseLib && pdfParseLib.default) 
        ? pdfParseLib.default 
        : null;

dotenv.config();

// --- CLOUDINARY CONFIGURATION ---
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});

const app = express();
const PORT = process.env.PORT || 5000;

// --- CORS CONFIGURATION (Loose for Hackathon/Demos) ---
const allowedOrigins = [
  "http://localhost:5173", 
  "https://unitime-win.vercel.app", 
  "https://unitime.onrender.com"
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      // Allow it anyway to prevent demo fails
      return callback(null, true); 
    }
    return callback(null, true);
  },
  credentials: true
}));

// Middleware - INCREASE LIMIT for images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Memory Storage for File Uploads
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// --- HELPER: UPLOAD BUFFER TO CLOUDINARY ---
const uploadToCloudinary = (buffer, mimetype, folder = "unitime_uploads") => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { 
                resource_type: "auto",
                folder: folder
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );
        Readable.from(buffer).pipe(uploadStream);
    });
};

// --- 2. INTELLIGENT AI ANALYSIS FUNCTION (Your FULL Logic) ---
async function analyzeWithAI(fileBuffer, mimetype, availableTime, studentData) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("Missing GEMINI_API_KEY in .env file");
    }
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // --- PREPARE PROMPT PARTS ---
    let promptParts = [];
    let fileContextMsg = "No file uploaded.";

    // A. HANDLE IMAGES (PNG, JPG, JPEG)
    if (fileBuffer && mimetype.startsWith('image/')) {
        console.log(`📸 Processing Image: ${mimetype} (${fileBuffer.length} bytes)`);
        
        const imagePart = {
            inlineData: {
                data: fileBuffer.toString('base64'),
                mimeType: mimetype
            }
        };
        promptParts.push(imagePart);
        fileContextMsg = "Image of schedule provided.";
    } 
    // B. HANDLE PDF (Extract Text)
    else if (fileBuffer && mimetype === 'application/pdf') {
        try {
            if (!pdfParse) {
                fileContextMsg = "PDF content skipped (Library missing).";
            } else {
                const pdfData = await pdfParse(fileBuffer);
                const text = (pdfData.text || "").slice(0, 10000); 
                promptParts.push(text);
                console.log(`✅ Extracted ${text.length} characters from PDF.`);
                fileContextMsg = "PDF Text content provided.";
            }
        } catch (error) {
            console.warn("⚠️ PDF Read Error:", error.message);
            fileContextMsg = "Error reading PDF file.";
        }
    }
    // C. HANDLE TEXT FILES
    else if (fileBuffer) {
        const text = fileBuffer.toString('utf-8').slice(0, 10000);
        promptParts.push(text);
        fileContextMsg = "Text file content provided.";
    }

    // --- ADD INSTRUCTIONS TO PROMPT ---
    const textPrompt = `
        Act as an expert academic planner.
        
        CONTEXT:
        - Available Time: ${availableTime} minutes.
        - Student Data: ${JSON.stringify(studentData || {})}
        - File Status: ${fileContextMsg}
        
        TASK:
        1. Analyze the provided schedule/image.
        2. Create a specific study session plan.
        3. EXTRACT ANALYTICS DATA based on the schedule intensity and subjects found.
        
        OUTPUT FORMAT (Strict JSON, no markdown):
        { 
          "primaryTask": "Task Name", 
          "reason": "Why this is the priority", 
          "alternatives": [
            {"task": "Alt 1", "reason": "Why"},
            {"task": "Alt 2", "reason": "Why"}
          ],
          "analyticsData": {
             "totalHours": "Estimated total study hours (e.g. '24h')",
             "productivityScore": "Estimated score (e.g. '85%')",
             "streak": "Current streak (e.g. '5')",
             "totalSessions": "Count (e.g. '12')",
             "weeklyProgress": [
                {"day": "Mon", "value": 80, "hours": 5},
                {"day": "Tue", "value": 60, "hours": 4},
                {"day": "Wed", "value": 90, "hours": 6},
                {"day": "Thu", "value": 70, "hours": 4},
                {"day": "Fri", "value": 50, "hours": 3},
                {"day": "Sat", "value": 40, "hours": 2},
                {"day": "Sun", "value": 30, "hours": 1}
             ],
             "subjectBreakdown": [
                {"subject": "Subject 1", "hours": 10, "percentage": 40, "color": "bg-blue-500", "students": 0},
                {"subject": "Subject 2", "hours": 8, "percentage": 30, "color": "bg-green-500", "students": 0},
                {"subject": "Subject 3", "hours": 6, "percentage": 30, "color": "bg-yellow-500", "students": 0}
             ]
          }
        }
    `;
    
    promptParts.push(textPrompt);

    // --- TRY MODELS (Your Robust Fallback Loop) ---
    // Valid stable models as of 2025: gemini-2.5-flash, gemini-2.5-flash-lite
    // Updated based on API key availability - only 2.5 models work
    const candidates = [
        "gemini-2.5-flash",        // Stable, fast, production-ready
        "gemini-2.5-flash-lite"    // Stable, faster, cost-efficient
    ];

    for (const modelName of candidates) {
        try {
            console.log(`🤖 Attempting AI Model: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            
            const result = await model.generateContent(promptParts);
            const response = await result.response;
            
            const cleanText = response.text().replace(/```json|```/g, '').trim();
            return JSON.parse(cleanText);

        } catch (error) {
            if (error.message.includes('429')) {
                console.warn(`⏳ Quota exceeded for ${modelName}. Switching...`);
            } else if (error.message.includes('404') || error.message.includes('not found')) {
                console.log(`🔹 Model ${modelName} not available, switching...`);
            } else {
                console.warn(`❌ Error with ${modelName}:`, error.message.split('[')[0]);
            }
        }
    }
    throw new Error("All AI models failed. Please wait 60 seconds or check API Quota.");
}

// --- ROUTES ---

app.get('/', (req, res) => res.send("✅ UniTime Server is Running!"));

// --- PROFILE PICTURE UPLOAD ROUTE ---
app.post('/api/upload-profile', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No file provided" });
        
        console.log("📸 Uploading Profile Picture...");
        const result = await uploadToCloudinary(req.file.buffer, req.file.mimetype, "unitime_profiles");
        
        console.log("✅ Profile Upload Success:", result.secure_url);
        res.json({ url: result.secure_url });
    } catch (error) {
        console.error("❌ Profile Upload Error:", error);
        res.status(500).json({ error: "Upload failed" });
    }
});

// --- ANALYZE ROUTE (Uses Your Intelligent Logic) ---
app.post('/api/analyze', upload.single('file'), async (req, res) => {
    try {
        console.log(`📥 Analyze Request: ${req.file ? req.file.mimetype : "No File"}`);
        
        let cloudinaryResult = null;
        
        // 1. Upload to Cloudinary (if file exists)
        if (req.file) {
            console.log("☁️ Uploading to Cloudinary...");
            try {
                cloudinaryResult = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
                console.log("✅ Cloudinary Upload Success:", cloudinaryResult.secure_url);
            } catch (uploadError) {
                console.error("❌ Cloudinary Upload Failed:", uploadError);
            }
        }

        // 2. Perform AI Analysis
        const aiResult = await analyzeWithAI(
            req.file ? req.file.buffer : null,
            req.file ? req.file.mimetype : null,
            req.body.availableTime || 60,
            req.body.studentData
        );
        
        // 3. Combine Results
        const finalResponse = {
            ...aiResult,
            fileUrl: cloudinaryResult ? cloudinaryResult.secure_url : null,
            fileId: cloudinaryResult ? cloudinaryResult.public_id : null
        };

        console.log("✅ Analysis Successful");
        res.json(finalResponse);

    } catch (error) {
        console.error("🔥 Analysis Failed:", error.message);
        res.status(500).json({ 
            error: "Analysis Failed", 
            details: error.message 
        });
    }
});

// --- CHAT ROUTE (Uses Friend's STATIC Logic as Requested) ---
app.post('/api/chat', (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: "No prompt provided" });

        const lowerInput = prompt.toLowerCase().trim();
        console.log("💬 User asked (Static Mode):", lowerInput);

        let reply = "";

        // --- 🤖 DEMO LOGIC (If-Else Magic) ---
        if (["hi", "hello", "hey", "hii", "hello!"].some(word => lowerInput.includes(word))) {
            reply = "Hello, I am UniTime AI. How may I help you optimize your schedule today?";
        } 
        else if (lowerInput.includes("who are you") || lowerInput.includes("what is unitime")) {
            reply = "I am UniTime AI, a smart assistant designed to help students and teachers manage their time, fill gaps, and boost productivity.";
        } 
        else if (lowerInput.includes("help") || lowerInput.includes("features")) {
            reply = "I can help you with:\n1. Analyzing your timetable 📅\n2. Suggesting study plans 📚\n3. Tracking your productivity 📈";
        } 
        else if (lowerInput.includes("plan") || lowerInput.includes("study")) {
            reply = "Sure! I can create a study plan for you. I see you have a free slot at 2 PM. Shall we schedule a revision session?";
        } 
        else if (lowerInput.includes("cancel") || lowerInput.includes("gap")) {
            reply = "Got a free slot? Great! I recommend using this time for a quick revision of your last lecture.";
        } 
        else {
            reply = "That sounds interesting! Could you upload your schedule so I can give you a better recommendation?";
        }

        // Fake Delay to look like AI
        setTimeout(() => {
            res.json({ text: reply });
        }, 800);

    } catch (error) {
        console.error("Chat Error:", error);
        res.json({ text: "Hello! I am UniTime AI. How may I help you?" });
    }
});

app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
});