import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import type { StressRiskLevel } from '../types/monitoring';

interface ChickenStatusAnimationProps {
  chickenPresent: boolean | null | undefined;
  stressRisk: StressRiskLevel | undefined;
}

export default function ChickenStatusAnimation({
  chickenPresent,
  stressRisk,
}: ChickenStatusAnimationProps) {
  const illustrationRef = useRef<SVGSVGElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const wingRef = useRef<SVGPathElement>(null);
  const pulseRef = useRef<SVGCircleElement>(null);
  const previousRiskRef = useRef<StressRiskLevel | undefined>(undefined);
  const previousPresenceRef = useRef<boolean | null | undefined>(undefined);

  useLayoutEffect(() => {
    const illustration = illustrationRef.current;
    const body = bodyRef.current;
    const head = headRef.current;
    const wing = wingRef.current;
    const pulse = pulseRef.current;

    if (!illustration || !body || !head || !wing || !pulse) return;

    const context = gsap.context(() => {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      gsap.set([body, head, wing], { transformOrigin: 'center bottom' });
      gsap.set(pulse, { transformOrigin: 'center center', opacity: 0 });

      if (reduceMotion) {
        gsap.set(body, { y: 0, scale: 1 });
        gsap.set(head, { rotation: 0 });
        gsap.set(wing, { rotation: chickenPresent ? -8 : 0 });
        return;
      }

      gsap.to(body, {
        y: -3,
        scale: 1.015,
        duration: 1.8,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });

      if (chickenPresent && previousPresenceRef.current !== true) {
        gsap.fromTo(
          wing,
          { rotation: -2 },
          { rotation: -18, duration: 0.18, ease: 'power2.out', yoyo: true, repeat: 3 },
        );
      }

      const riskChanged = previousRiskRef.current !== undefined && previousRiskRef.current !== stressRisk;
      const elevatedRisk = stressRisk === 'MEDIUM' || stressRisk === 'HIGH';

      if (riskChanged && elevatedRisk) {
        gsap.timeline()
          .to(illustration, { x: -2, duration: 0.06, ease: 'power1.out' })
          .to(illustration, { x: 2, duration: 0.12, ease: 'power1.inOut', repeat: 3, yoyo: true })
          .to(illustration, { x: 0, duration: 0.06 })
          .fromTo(pulse, { scale: 0.7, opacity: 0.45 }, { scale: 1.35, opacity: 0, duration: 0.7, ease: 'power2.out' }, 0);
      }
    }, illustration);

    previousRiskRef.current = stressRisk;
    previousPresenceRef.current = chickenPresent;

    return () => context.revert();
  }, [chickenPresent, stressRisk]);

  return (
    <svg
      ref={illustrationRef}
      viewBox="0 0 128 128"
      role="img"
      aria-label={chickenPresent ? 'Chicken activity detected' : 'Chicken status illustration'}
      className="h-24 w-24 overflow-visible"
    >
      <circle ref={pulseRef} cx="64" cy="64" r="43" fill="none" stroke="#f59e0b" strokeWidth="3" />
      <g ref={bodyRef}>
        <ellipse cx="63" cy="77" rx="31" ry="25" fill="#f6c453" />
        <path ref={wingRef} d="M42 71c8-10 20-8 24 2-4 9-13 13-23 10" fill="#e8a932" stroke="#b7791f" strokeWidth="2" />
        <path d="M52 97v10M70 98v9" fill="none" stroke="#b7791f" strokeWidth="4" strokeLinecap="round" />
        <path d="M47 107h9M65 107h9" fill="none" stroke="#b7791f" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g ref={headRef}>
        <circle cx="78" cy="47" r="22" fill="#ffd978" />
        <path d="M71 28c2-9 7-9 9 0 5-8 10-5 7 3" fill="#ef6262" />
        <circle cx="85" cy="43" r="3" fill="#334155" />
        <path d="M96 50l13 5-13 6z" fill="#ef8a32" />
        <path d="M78 55c5 5 10 5 14 1" fill="none" stroke="#b7791f" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}