function calculateCombinedStressRisk(data) {
  const { heatIndex, motionLevel, aiStressRisk } = data;

  // Calculate environmental heat risk regardless of chicken presence for sensor logging
  let envRisk = "LOW";
  if (heatIndex >= 32.0) {
    envRisk = "HIGH";
  } else if (heatIndex >= 27.0) {
    envRisk = "MEDIUM";
  }

  // Short-circuit if no chicken is detected in the coop
  if (aiStressRisk === "NONE") {
    return {
      finalStressRisk: "NONE",
      environmentalRisk: envRisk,
      evaluationSummary: "No chicken detected in coop. Stress evaluation bypassed."
    };
  }

  let finalRisk = "LOW";
  let reasons = [];

  if (envRisk === "HIGH" || aiStressRisk === "HIGH") {
    finalRisk = "HIGH";
    if (envRisk === "HIGH") reasons.push("Critical ambient Heat Index detected.");
    if (aiStressRisk === "HIGH") reasons.push("High observable behavioral stress indicators present in image.");
  } else if (envRisk === "MEDIUM" || aiStressRisk === "MEDIUM") {
    finalRisk = "MEDIUM";
    if (envRisk === "MEDIUM") reasons.push("Elevated Heat Index detected.");
    if (aiStressRisk === "MEDIUM") reasons.push("Moderate behavioral discomfort observed.");
    if (motionLevel === "LOW") reasons.push("Abnormal physical inactivity detected.");
  } else {
    finalRisk = "LOW";
    reasons.push("Environmental and visual parameters within nominal ranges.");
  }

  return {
    finalStressRisk: finalRisk,
    environmentalRisk: envRisk,
    evaluationSummary: reasons.join(" ")
  };
}

module.exports = { calculateCombinedStressRisk };