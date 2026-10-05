import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { useAuth } from '../context/AuthContext';
import CoopScoutMascot from '../components/CoopScoutMascot';

export default function Login() {
  const { configured, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const sceneRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const panel = scene.querySelector('[data-login-panel]');
    const signals = scene.querySelectorAll('[data-signal]');
    if (reduceMotion) {
      scene.classList.add('motion-reduced');
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(panel, { opacity: 0, y: 24, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: 'power3.out' });
      gsap.fromTo(signals, { opacity: 0, x: -18 }, { opacity: 1, x: 0, duration: 0.7, stagger: 0.12, delay: 0.35, ease: 'power2.out' });
      gsap.to(scene.querySelector('[data-pulse]'), { scale: 1.18, opacity: 0.18, duration: 1.8, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      gsap.to(scene.querySelector('[data-orbit]'), { rotate: 360, duration: 24, repeat: -1, ease: 'none' });
    }, scene);

    return () => context.revert();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      const from = (location.state as { from?: string } | null)?.from || '/dashboard';
      setTransitioning(true);
      window.setTimeout(() => navigate(from, { replace: true }), 1300);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main ref={sceneRef} className={`login-shell ${transitioning ? 'login-transitioning' : ''}`}>
      <div className="login-orbit" data-orbit aria-hidden="true" />
      <div className="login-pulse" data-pulse aria-hidden="true" />
      <section className="login-panel" data-login-panel>
        <div className="mascot-stage"><CoopScoutMascot mood={transitioning ? 'alert' : 'calm'} risk={transitioning ? 'HIGH' : 'LOW'} /></div>
        <div className="panel-heading"><h2>Welcome back</h2><p>Sign in to check on your flock and today’s coop signals.</p></div>
        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
          <div className="password-label"><label htmlFor="password">Password</label><button type="button" className="visibility-button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
          <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required />
          {error && <p className="login-error" role="alert">{error}</p>}
          {!configured && <p className="login-config" role="status">Supabase Auth is not configured for this frontend yet.</p>}
          <button className="login-submit" type="submit" disabled={loading || submitting || transitioning || !configured}><span>{submitting ? 'Waking the coop...' : 'Log in'}</span><ArrowRight size={18} /></button>
        </form>
        <div className="panel-security"><span>Encrypted session · authorized personnel only</span></div>
      </section>
      {transitioning && <div className="login-transition" role="status" aria-live="polite"><div className="transition-mascot"><img src="/loading.jpg" alt="Coop Scout reading the latest monitoring signals" /></div><strong>Waking the coop</strong><span>Gathering today’s signals...</span><div className="transition-progress"><i /></div></div>}
    </main>
  );
}
