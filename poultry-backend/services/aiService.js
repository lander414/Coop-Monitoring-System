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

function getDefaultSuggestions(risk, indicators = []) {
  const hasPanting = indicators.includes('open_mouth_panting');
  const hasWings = indicators.includes('wings_spread_away');
  const hasLethargy = indicators.includes('abnormal_inactivity') || indicators.includes('lethargy');

  switch (risk) {
    case 'HIGH': {
      const suggestions = [
        'Engage all tunnel and exhaust fans immediately to reach high air velocity (1.5 - 2.5 m/s) across the flock.',
        'Replenish drinker lines with cool, fresh water and supplement with electrolytes/vitamin C to counteract panting alkalosis.',
        'Activate fogging or misting systems if indoor relative humidity is below 70%.'
      ];
      if (hasLethargy || hasPanting) {
        suggestions.push('Inspect flock immediately for prostrated birds and transfer them to a shaded, well-ventilated recovery crate.');
      }
      return suggestions;
    }
    case 'MEDIUM': {
      const suggestions = [
        'Increase ventilation fan stages and open cross-ventilation baffles to eliminate stagnant warm air pockets.',
        'Flush drinker lines with fresh water to ensure water temperature remains cool and enticing.',
        'Avoid handling, vaccinating, or feeding the flock during the hottest midday peak hours.'
      ];
      if (hasWings) {
        suggestions.push('Check flock stocking density around feeders and ensure unobstructed airflow at bird level.');
      }
      return suggestions;
    }
    case 'LOW':
      return [
        'Maintain standard continuous fresh air exchange to remove moisture, dust, and carbon dioxide.',
        'Inspect drinker lines and nipple valves for consistent flow and cleanliness.',
        'Continue routine visual monitoring; flock exhibits normal behavioral comfort.'
      ];
    case 'NONE':
    default:
      return [
        'Ensure the camera or photo is aimed directly at the active flock roosting or feeding area.',
        'Verify coop lighting and remove any visual obstruction in front of the lens.'
      ];
  }
}

function formatFullDescription(description, suggestions) {
  const base = (description || '').trim();
  if (!suggestions || !suggestions.length) return base;
  const list = suggestions.map((s) => `• ${s}`).join('\n');
  return base ? `${base}\n\nSuggested Actions:\n${list}` : `Suggested Actions:\n${list}`;
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
      description: "Observable behavioral signs of moderate heat distress detected.",
      suggestions: getDefaultSuggestions("MEDIUM", ["wings_spread_away", "open_mouth_panting"])
    };
  }

  // Model fallback chain prioritized to avoid 503 Service Unavailable / High Demand errors.
  // Flash-Lite models offer significantly higher throughput and avoid peak server constraints.
  const configuredModel = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : [];
  const candidateModels = Array.from(new Set([
    ...configuredModel,
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash"
  ]));
  let lastError = null;

  const prompt = `
    You are an automated poultry visual behavior analyzer and avian welfare expert.
    
    STEP 1: PRESENCE CHECK
    First, verify if there is at least one live chicken or poultry bird clearly visible in the image.
    If NO chicken is detected:
    - return "stress_risk": "NONE"
    - set "confidence": 1.0
    - set "indicators": []
    - set "description": "No chicken detected in the image."
    - set "suggestions": [
        "Position the camera or take photos directly facing the flock living area.",
        "Ensure sufficient lighting in the coop so birds are clearly identifiable."
      ]

    STEP 2: BEHAVIORAL ANALYSIS
    If a chicken IS detected, analyze it for observable physical and behavioral heat stress-risk indicators:
    1. Open-mouth breathing or panting (rapid respiratory distress)
    2. Wings held spread away from the body (shedding internal body heat)
    3. Abnormal inactivity, lethargy, or reluctance to move
    4. Huddling/crowding or unusual posture
    
    STEP 3: ACTIONABLE SUGGESTIVE INSTRUCTIONS
    Provide 2 to 4 concise, high-priority suggestive instructions for the caretaker:
    - If HIGH: urgent interventions (e.g. max ventilation, cool electrolyte water, misting, flock inspection).
    - If MEDIUM: preventative measures (e.g. increase exhaust airflow, check cool water temperature, provide shade).
    - If LOW: routine best practices (e.g. maintain continuous fresh air exchange, clean water supply).
    
    Return ONLY a JSON object matching this exact schema:
    {
      "stress_risk": "NONE" | "LOW" | "MEDIUM" | "HIGH",
      "confidence": number,
      "indicators": array of strings,
      "description": "Brief description of observed visual indicators or presence status",
      "suggestions": array of strings
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

      const parsed = JSON.parse(responseText);

      // Ensure suggestions array is populated
      if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
        parsed.suggestions = getDefaultSuggestions(parsed.stress_risk, parsed.indicators);
      }

      return parsed;
    } catch (error) {
      console.warn(`Attempt with model '${modelName}' failed: ${error.message}`);
      lastError = error;
    }
  }

  // If all model attempts fail, log and return graceful unknown status fallback
  console.error("AI Analysis Execution Error:", lastError ? lastError.message : "Unknown error");
  
  const is503 = lastError && lastError.message && (lastError.message.includes('503') || lastError.message.includes('high demand'));
  const friendlyDescription = is503
    ? "AI service is temporarily busy (Google servers are experiencing high demand). Please retry in a few moments."
    : "Unable to complete AI image analysis: " + (lastError ? lastError.message : "All model endpoints failed.");

  return {
    stress_risk: "UNKNOWN",
    confidence: 0.0,
    indicators: ["analysis_failed"],
    description: friendlyDescription,
    suggestions: [
      "Check server internet connectivity and Gemini API key status.",
      "Retry the photo analysis in a few moments."
    ]
  };
}

module.exports = {
  analyzeChickenImage,
  getDefaultSuggestions,
  formatFullDescription
};