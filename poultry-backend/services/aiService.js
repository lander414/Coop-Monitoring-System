const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "MOCK_KEY");

function fileToGenerativePart(path, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType
    },
  };
}

async function analyzeChickenImage(imagePath, mimeType) {
  // Fallback to local mock data if no valid Gemini API key is configured
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE" || process.env.GEMINI_API_KEY === "MOCK_KEY") {
    console.warn("API Key missing or invalid. Returning local mock analysis for COOP-16.");
    await new Promise((resolve) => setTimeout(resolve, 300));
    return {
      stress_risk: "MEDIUM",
      confidence: 0.88,
      indicators: ["wings_spread_away", "open_mouth_panting"],
      description: "Observable behavioral signs of moderate heat distress detected."
    };
  }

  // Model fallback chain prioritized to avoid 503 delays
  // Gemini 3.6 Flash is used as the primary stable model.
  const candidateModels = ["gemini-3.6-flash", "gemini-3.5-flash"];
  let lastError = null;

  const prompt = `
    You are an automated poultry visual behavior analyzer. 
    
    STEP 1: PRESENCE CHECK
    First, verify if there is at least one live chicken or poultry bird clearly visible in the image.
    If NO chicken is detected, return "stress_risk": "NONE", set confidence to 1.0, leave indicators empty, and state "No chicken detected in the image" in the description.

    STEP 2: BEHAVIORAL ANALYSIS
    If a chicken IS detected, analyze it for observable physical and behavioral heat stress-risk indicators.
    Look strictly for:
    1. Open-mouth breathing or panting
    2. Wings held spread away from the body
    3. Abnormal inactivity or lethargy
    4. Huddling/crowding or unusual posture
    
    Return ONLY a JSON object matching this exact schema:
    {
      "stress_risk": "NONE" | "LOW" | "MEDIUM" | "HIGH",
      "confidence": number,
      "indicators": array of strings,
      "description": "Brief description of observed visual indicators or presence status"
    }
  `;

  const imagePart = fileToGenerativePart(imagePath, mimeType);

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json"
        }
      });

      const result = await model.generateContent([prompt, imagePart]);
      let responseText = result.response.text().trim();

      // Clean up markdown code block formatting if returned by model
      if (responseText.startsWith("```json")) {
        responseText = responseText.replace(/^```json/, "").replace(/```$/, "").trim();
      } else if (responseText.startsWith("```")) {
        responseText = responseText.replace(/^```/, "").replace(/```$/, "").trim();
      }

      return JSON.parse(responseText);
    } catch (error) {
      console.warn(`Attempt with model '${modelName}' failed: ${error.message}`);
      lastError = error;
    }
  }

  // If all model attempts fail, log and return graceful unknown status fallback
  console.error("AI Analysis Execution Error:", lastError ? lastError.message : "Unknown error");
  return {
    stress_risk: "UNKNOWN",
    confidence: 0.0,
    indicators: ["analysis_failed"],
    description: "Unable to complete AI image analysis: " + (lastError ? lastError.message : "All model endpoints failed.")
  };
}

module.exports = { analyzeChickenImage };