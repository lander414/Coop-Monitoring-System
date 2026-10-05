import type { StressRiskLevel } from '../types/monitoring';

type CoopScoutMascotProps = {
  mood?: 'calm' | 'alert';
  risk?: StressRiskLevel;
};

const riskLabels: Record<StressRiskLevel, string> = {
  NONE: 'No flock detected',
  LOW: 'Low stress risk',
  MEDIUM: 'Medium stress risk',
  HIGH: 'High stress risk',
};

export default function CoopScoutMascot({ mood = 'calm', risk }: CoopScoutMascotProps) {
  const selectedRisk = risk ?? (mood === 'alert' ? 'HIGH' : 'LOW');

  return (
    <div className={`coop-scout coop-scout-${mood} coop-scout-risk-${selectedRisk.toLowerCase()}`} aria-label={`Coop Scout: ${riskLabels[selectedRisk]}`} role="img">
      <span className="coop-scout-sprite" aria-hidden="true" />
    </div>
  );
}
