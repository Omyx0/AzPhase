// server/check_models.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require('dotenv');
dotenv.config();

async function listModels() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Check available models for your API key
    console.log("Checking available models for your API key...");
    console.log("Testing valid stable models (as of 2025):\n");
    
    // Valid stable models as of 2025
    const candidates = [
        "gemini-2.5-flash",        // Stable, fast, production-ready
        "gemini-2.5-flash-lite",   // Stable, faster, cost-efficient
        "gemini-2.5-pro",          // Stable, more capable
        "gemini-1.5-flash",        // Older but still supported
        "gemini-1.5-pro"           // Older but still supported
    ];

    for (const modelName of candidates) {
        process.stdout.write(`Testing ${modelName}... `);
        try {
            const m = genAI.getGenerativeModel({ model: modelName });
            await m.generateContent("Hello");
            console.log("✅ SUCCESS!");
        } catch (e) {
            console.log("❌ Failed (" + e.message.split('[')[0] + ")");
        }
    }

  } catch (error) {
    console.error("Error:", error);
  }
}

listModels();