const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require('dotenv');
dotenv.config();

// FIX: Safe Import for PDF Parse
let pdfParse;
try {
    pdfParse = require('pdf-parse');
} catch (e) {
    console.error("Warning: pdf-parse not found. File analysis will be skipped.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.getSmartSchedule = async (req, res) => {
  try {
    const { availableTime, studentData } = req.body;
    let fileText = "";

    // 1. Safe File Processing
    if (req.file) {
        console.log(`Received file: ${req.file.originalname}`);
        try {
            if (req.file.mimetype === 'application/pdf' && pdfParse) {
                // Try to parse PDF
                const pdfData = await pdfParse(req.file.buffer);
                fileText = pdfData.text; 
                console.log("✅ PDF Parsed successfully");
            } else {
                // Try plain text
                fileText = req.file.buffer.toString('utf-8');
            }
        } catch (fileError) {
            console.error("⚠️ File Read Error:", fileError.message);
            // Fallback: Proceed without file content so app doesn't crash
            fileText = "Could not read file. Please generate plan based on general context.";
        }
    }

    // 2. Validate Inputs
    if (!availableTime) {
      return res.status(400).json({ error: "Available time is required" });
    }

    // 3. FIX: Using valid stable models (gemini-pro is retired)
    // Updated based on API key availability - only 2.5 models work
    const modelCandidates = [
        "gemini-2.5-flash",        // Stable, fast, production-ready
        "gemini-2.5-flash-lite"    // Stable, faster, cost-efficient
    ];

    const prompt = `
      Act as an academic planner.
      Student has ${availableTime} minutes available right now.
      
      Context from uploaded schedule (if any):
      "${fileText.slice(0, 2000)}" 

      Student Goal: ${studentData || 'General Study'}.
      
      Create a short, actionable study plan. 
      Return JSON only (NO markdown):
      { 
        "primaryTask": "Task Name", 
        "reason": "Why this is important", 
        "alternatives": [{"task": "Alt Task 1", "reason": "Reason 1"}] 
      }
    `;

    let result;
    let lastError;
    for (const modelName of modelCandidates) {
        try {
            console.log(`🤖 Attempting AI Model: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            result = await model.generateContent(prompt);
            console.log(`✅ Success with model: ${modelName}`);
            break;
        } catch (error) {
            lastError = error;
            if (error.message.includes('404') || error.message.includes('not found')) {
                console.log(`🔹 Model ${modelName} not available, trying next...`);
            } else {
                console.warn(`❌ Error with ${modelName}:`, error.message.split('[')[0]);
            }
        }
    }
    
    if (!result) {
        throw new Error(`All models failed. Last error: ${lastError?.message}`);
    }
    const response = await result.response;
    const text = response.text();
    
    // Clean JSON
    const jsonStr = text.replace(/```json|```/g, '').trim();
    
    res.json(JSON.parse(jsonStr));

  } catch (error) {
    console.error("❌ AI Controller Error:", error);
    res.status(500).json({ error: "Analysis Failed. Check server logs." });
  }
};