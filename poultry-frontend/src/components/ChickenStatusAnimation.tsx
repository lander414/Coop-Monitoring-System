import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import type { StressRiskLevel } from '../types/monitoring';
import CoopScoutMascot from './CoopScoutMascot';

interface ChickenStatusAnimationProps {
  chickenPresent: boolean | null | undefined;
  stressRisk: StressRiskLevel | undefined;
}

export default function ChickenStatusAnimation({ chickenPresent, stressRisk }: ChickenStatusAnimationProps) {
  const illustrationRef = useRef<HTMLDivElement>(null);
  const previousRiskRef = useRef<StressRiskLevel | undefined>(undefined);
  const risk = stressRisk ?? (chickenPresent === false ? 'NONE' : 'LOW');

  useLayoutEffect(() => {
    const illustration = illustrationRef.current;
    if (!illustration) return;

    const context = gsap.context(() => {
      const mascot = illustration.querySelector('.coop-scout');
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!mascot || reduceMotion) return;

      gsap.to(mascot, { y: -2, duration: 2.8, ease: 'sine.inOut', repeat: -1, yoyo: true });
      const riskChanged = previousRiskRef.current !== undefined && previousRiskRef.current !== stressRisk;
      if (riskChanged && (stressRisk === 'MEDIUM' || stressRisk === 'HIGH')) {
        gsap.timeline()
          .to(mascot, { x: -2, duration: 0.06, ease: 'power1.out' })
          .to(mascot, { x: 2, duration: 0.12, ease: 'power1.inOut', repeat: 3, yoyo: true })
          .to(mascot, { x: 0, duration: 0.06 });
      }
    }, illustration);

    previousRiskRef.current = stressRisk;
    return () => context.revert();
  }, [stressRisk]);

  return (
    <div ref={illustrationRef} className="chicken-status-mascot" role="img" aria-label={chickenPresent ? 'Chicken activity detected' : 'Chicken status illustration'}>
      <CoopScoutMascot risk={risk} mood={risk === 'HIGH' ? 'alert' : 'calm'} />
    </div>
  );
}
