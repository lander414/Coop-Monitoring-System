import type { StressRiskLevel } from '../types/monitoring';

export interface ParsedInstruction {
  id: string;
  category: 'ventilation' | 'hydration' | 'environment' | 'monitoring';
  title: string;
  detail: string;
}

export function extractSuggestions(
  description?: string | null,
  risk?: StressRiskLevel | 'UNKNOWN' | null,
  indicators?: string[] | null,
  rawSuggestions?: string[] | null
): string[] {
  // 1. If explicit suggestions array is provided and not empty
  if (Array.isArray(rawSuggestions) && rawSuggestions.length > 0) {
    return rawSuggestions;
  }

  // 2. If description has embedded "Suggested Actions:"
  if (description && description.includes('Suggested Actions:')) {
    const parts = description.split('Suggested Actions:');
    if (parts[1]) {
      const lines = parts[1]
        .split('\n')
        .map((l) => l.trim().replace(/^[•\-\*\d\.]+\s*/, ''))
        .filter((l) => l.length > 0);
      if (lines.length > 0) return lines;
    }
  }

  // 3. Scientifically-grounded fallback based on stress risk and indicators
  const hasPanting = indicators?.includes('open_mouth_panting');
  const hasWings = indicators?.includes('wings_spread_away');
  const hasLethargy = indicators?.includes('abnormal_inactivity') || indicators?.includes('lethargy');

  switch (risk) {
    case 'HIGH': {
      const items = [
        'Engage all tunnel and exhaust fans immediately to reach high air velocity (1.5 - 2.5 m/s) across the flock.',
        'Replenish drinker lines with cool, fresh water and supplement with electrolytes/vitamin C to counteract panting alkalosis.',
        'Activate fogging or misting systems if indoor relative humidity is below 70%.'
      ];
      if (hasLethargy || hasPanting) {
        items.push('Inspect flock immediately for prostrated birds and transfer them to a shaded, well-ventilated recovery crate.');
      }
      return items;
    }
    case 'MEDIUM': {
      const items = [
        'Increase ventilation fan stages and open cross-ventilation baffles to eliminate stagnant warm air pockets.',
        'Flush drinker lines with fresh water to ensure water temperature remains cool and enticing.',
        'Avoid handling, vaccinating, or feeding the flock during the hottest midday peak hours.'
      ];
      if (hasWings) {
        items.push('Check flock stocking density around feeders and ensure unobstructed airflow at bird level.');
      }
      return items;
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

export function cleanDescriptionText(description?: string | null): string {
  if (!description) return '';
  if (description.includes('Suggested Actions:')) {
    return description.split('Suggested Actions:')[0].trim();
  }
  return description.trim();
}
