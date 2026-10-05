import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Droplets,
  Flame,
  Info,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Thermometer,
  ThermometerSnowflake,
  Wind
} from 'lucide-react';
import type { TelemetryLog } from '../types/monitoring';

interface FlockComfortSuggestionsProps {
  latest: TelemetryLog | null;
}

interface SuggestionItem {
  id: string;
  category: 'ventilation' | 'water' | 'climate' | 'husbandry';
  title: string;
  badge: {
    label: string;
    variant: 'danger' | 'warning' | 'info' | 'optimal';
  };
  icon: typeof Wind;
  action: string;
  scienceNote: string;
}

export default function FlockComfortSuggestions({ latest }: FlockComfortSuggestionsProps) {
  const [completedActions, setCompletedActions] = useState<Record<string, boolean>>({});
  const [showScienceGuide, setShowScienceGuide] = useState(false);

  const temperature = latest?.temperature ?? 24;
  const humidity = latest?.humidity ?? 60;
  const heatIndex = latest?.heat_index ?? temperature;
  const stressRisk = latest?.stress_risk ?? 'LOW';
  const hasTelemetry = latest !== null;

  // Thresholds based on poultry science (thermal neutral zone 18°C - 24°C, 50% - 70% RH)
  const isSevereHeat = hasTelemetry && (temperature >= 30 || heatIndex >= 32 || stressRisk === 'HIGH');
  const isModerateHeat = hasTelemetry && !isSevereHeat && (temperature >= 26 || heatIndex >= 28 || stressRisk === 'MEDIUM');
  const isCold = hasTelemetry && temperature < 18;
  const isHighHumidity = hasTelemetry && humidity > 70;
  const isOptimal = hasTelemetry && !isSevereHeat && !isModerateHeat && !isCold && humidity >= 50 && humidity <= 70;

  // Generate dynamic contextual suggestions
  const suggestions: SuggestionItem[] = [];

  // 1. VENTILATION & AIRFLOW SUGGESTION
  if (isSevereHeat) {
    suggestions.push({
      id: 'ventilation-max',
      category: 'ventilation',
      title: 'Turn on all exhaust fans to maximum (1.5 – 2.5 m/s airflow)',
      badge: { label: 'Immediate Action', variant: 'danger' },
      icon: Wind,
      action: 'Engage all tunnel and exhaust fans immediately. Achieve high-velocity air movement across the flock (target 1.5 to 2.5 m/s) to produce a strong convective wind-chill effect, lowering the heat felt by chickens by 3°C to 5°C.',
      scienceNote: 'Chickens lack sweat glands. High air velocity strips the thermal boundary heat layer trapped between feathers and skin, facilitating passive radiative and convective cooling.'
    });
  } else if (isModerateHeat) {
    suggestions.push({
      id: 'ventilation-boost',
      category: 'ventilation',
      title: 'Increase fan ventilation speed & open side air inlets',
      badge: { label: 'Recommended', variant: 'warning' },
      icon: Wind,
      action: 'Increase exhaust fan stages and open cross-ventilation baffles to maintain steady air exchange and prevent stagnant heat pockets from accumulating at bird level.',
      scienceNote: 'Continuous air movement helps birds reject internal body heat before they enter distressed panting stages.'
    });
  } else if (isCold) {
    suggestions.push({
      id: 'ventilation-cold',
      category: 'ventilation',
      title: 'Reduce drafts & restrict high-velocity airflow',
      badge: { label: 'Cold Protection', variant: 'info' },
      icon: Wind,
      action: 'Close drafty openings and adjust air inlets high toward the ceiling. Maintain only minimum timer-based ventilation to remove ammonia and moisture without creating cold floor drafts.',
      scienceNote: 'Cold air drafts dropping directly on birds trigger respiratory illness and increase feed conversion waste for thermogenesis.'
    });
  } else {
    suggestions.push({
      id: 'ventilation-optimal',
      category: 'ventilation',
      title: 'Maintain standard fresh air exchange',
      badge: { label: 'Optimal Condition', variant: 'optimal' },
      icon: Wind,
      action: 'Airflow is within normal operating limits. Keep standard minimum ventilation cycling to ensure constant fresh oxygen and exhaust carbon dioxide.',
      scienceNote: 'Flock is in thermal comfort balance. Continuous gentle air exchange preserves lung health.'
    });
  }

  // 2. HYDRATION & DRINKER MANAGEMENT
  if (isSevereHeat) {
    suggestions.push({
      id: 'water-flush-electrolytes',
      category: 'water',
      title: 'Flush water lines & add electrolytes + Vitamin C',
      badge: { label: 'Immediate Action', variant: 'danger' },
      icon: Droplets,
      action: 'Flush drinker lines with fresh cool water so drinker temperature stays below 20°C. Add water-soluble electrolytes (potassium chloride, sodium bicarbonate) and Vitamin C (1g / 10L) into the header tank.',
      scienceNote: 'Chickens drink up to 300% more water under heat, but completely refuse water warmer than 25°C. Heavy panting causes respiratory alkalosis and loss of blood electrolytes; supplemental potassium and bicarbonate prevent heat prostration and death.'
    });
  } else if (isModerateHeat) {
    suggestions.push({
      id: 'water-check-flow',
      category: 'water',
      title: 'Replenish cool water & inspect drinker line flow',
      badge: { label: 'Recommended', variant: 'warning' },
      icon: Droplets,
      action: 'Check drinker nipple flow rates and inspect header tank temperature. Ensure every bird has uninhibited access to cool, fresh drinking water without crowding.',
      scienceNote: 'Readily accessible cool water is the most critical physiological heat buffer for poultry.'
    });
  } else {
    suggestions.push({
      id: 'water-routine',
      category: 'water',
      title: 'Verify continuous fresh, clean water flow',
      badge: { label: 'Routine Check', variant: 'optimal' },
      icon: Droplets,
      action: 'Inspect water pressure regulators and sanitize nipple lines. Keep water cool and free of mineral or biofilm deposits.',
      scienceNote: 'Standard water consumption is 1.8 to 2.0 times the feed intake by weight under comfort zone conditions.'
    });
  }

  // 3. COOLING & CLIMATE CONTROL
  if (isSevereHeat || isModerateHeat) {
    if (humidity >= 75) {
      suggestions.push({
        id: 'climate-no-misting',
        category: 'climate',
        title: '⚠️ Caution: DO NOT activate foggers or misting pads',
        badge: { label: 'Critical Rule', variant: 'danger' },
        icon: AlertCircle,
        action: `Coop relative humidity is already elevated (${humidity}%). Do not spray water or run misting nozzles. Adding water to saturated air prevents birds from evaporating moisture through panting and dramatically spikes mortality. Rely solely on high-speed exhaust fans.`,
        scienceNote: 'Avian respiratory panting depends entirely on the vapor pressure deficit between lungs and air. When relative humidity exceeds 75%, moisture cannot vaporize, suffocating bird cooling.'
      });
    } else {
      suggestions.push({
        id: 'climate-misting-pad',
        category: 'climate',
        title: 'Engage evaporative cooling pads or intermittent misting',
        badge: { label: 'Recommended Cooling', variant: 'info' },
        icon: ThermometerSnowflake,
        action: `Run evaporative cooling pads or cycle interior misting nozzles in 2–3 minute intervals. With humidity at ${humidity}%, water evaporation will absorb latent heat and drop ambient coop temperature by 4°C to 7°C.`,
        scienceNote: 'When ambient humidity is below 75%, evaporative cooling is highly efficient at pulling heat energy out of the coop atmosphere.'
      });
    }
  } else if (isCold) {
    suggestions.push({
      id: 'climate-heating',
      category: 'climate',
      title: 'Turn on brooder lamps / supplemental heat sources',
      badge: { label: 'Warmth Required', variant: 'info' },
      icon: Flame,
      action: 'Activate localized brooder heaters or infrared heat lamps to bring ambient temperature into the 18°C–24°C target zone. Secure side curtains to prevent draft infiltration.',
      scienceNote: 'Temperatures below 18°C cause birds to cluster and expend valuable dietary energy just shivering to stay warm.'
    });
  } else {
    suggestions.push({
      id: 'climate-balanced',
      category: 'climate',
      title: 'Microclimate is balanced in thermal neutral zone',
      badge: { label: 'Comfort Zone', variant: 'optimal' },
      icon: Sparkles,
      action: `Temperature (${temperature}°C) and humidity (${humidity}%) are in the ideal biological corridor. Neither heating nor active misting cooling is needed.`,
      scienceNote: 'At 18°C–24°C, chickens maintain core body temperature (41.5°C) with minimum metabolic stress.'
    });
  }

  // 4. HUSBANDRY & FEEDING INTERVENTIONS
  if (isSevereHeat || isModerateHeat) {
    suggestions.push({
      id: 'husbandry-feeding-shift',
      category: 'husbandry',
      title: 'Shift feeding schedule & withhold feed during peak heat',
      badge: { label: 'Feeding Management', variant: 'warning' },
      icon: Sparkles,
      action: 'Withhold or raise feeders during the hottest midday hours (11:00 AM – 4:00 PM). Shift the primary feeding window to early morning (5:00 AM – 8:00 AM) and late evening when coop temperatures drop.',
      scienceNote: 'Digestion generates substantial metabolic heat ("heat of digestion") peaking 3–5 hours after ingestion. Digestion heat combined with ambient midday heat leads to sudden flock mortality.'
    });
  } else if (isHighHumidity) {
    suggestions.push({
      id: 'husbandry-litter-check',
      category: 'husbandry',
      title: 'Inspect litter around waterers and rake damp bedding',
      badge: { label: 'Litter Care', variant: 'warning' },
      icon: AlertTriangle,
      action: 'High humidity increases wet litter. Turn over damp spots near drinker lines and top-dress with fresh dry pine shavings to stop ammonia formation.',
      scienceNote: 'Moist litter decomposes nitrogen rapidly, releasing toxic ammonia (NH3) gas that damages broiler cilia and eye membranes.'
    });
  } else {
    suggestions.push({
      id: 'husbandry-routine',
      category: 'husbandry',
      title: 'Routine flock welfare & automated visual check',
      badge: { label: 'Standard Husbandry', variant: 'optimal' },
      icon: ShieldCheck,
      action: 'Flock activity is calm and stable. Continue regular visual spot-checks via automated camera feed to verify even distribution across feeding and resting zones.',
      scienceNote: 'Evenly spaced birds without huddling or wing-drooping confirm full thermal comfort.'
    });
  }

  const toggleAction = (id: string) => {
    setCompletedActions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const completedCount = suggestions.filter((s) => completedActions[s.id]).length;

  const getStatusHeadline = () => {
    if (!hasTelemetry) return { title: 'Waiting for Telemetry', desc: 'Connect sensors or wait for ESP32 readings to display comfort recommendations.', style: 'bg-slate-100 text-slate-700 border-slate-200' };
    if (isSevereHeat) return { title: 'High Heat Distress Warning', desc: 'Critical thermal stress detected. Urgent cooling and hydration interventions needed to prevent heat prostration.', style: 'bg-red-50 text-red-700 border-red-200' };
    if (isModerateHeat) return { title: 'Moderate Thermal Strain', desc: 'Conditions are above the thermal neutral zone. Increase airflow and refresh cool water supply.', style: 'bg-amber-50 text-amber-800 border-amber-200' };
    if (isCold) return { title: 'Chilling Risk Warning', desc: 'Temperature is below flock comfort zone. Mitigate drafts and activate brooder heaters.', style: 'bg-blue-50 text-blue-700 border-blue-200' };
    if (isOptimal) return { title: 'Flock in Optimal Comfort Zone', desc: 'Temperature, humidity, and heat index are all within the ideal scientific comfort corridor.', style: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    return { title: 'Monitoring Coop Comfort', desc: 'Telemetry monitored. Review environmental guidance below.', style: 'bg-slate-50 text-slate-700 border-slate-200' };
  };

  const status = getStatusHeadline();

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="comfort-heading">
      {/* Top Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Flock Comfort Guide</p>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
              Science-Backed
            </span>
          </div>
          <h2 id="comfort-heading" className="mt-1 text-xl font-bold tracking-tight text-slate-900">
            Action suggestions for chicken comfort
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Automated environmental analysis with targeted ventilation, water, and climate interventions.
          </p>
        </div>

        {/* Action checklist counter */}
        <div className="flex items-center gap-2">
          <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
            {completedCount} of {suggestions.length} actions verified
          </span>
          {completedCount > 0 && (
            <button
              onClick={() => setCompletedActions({})}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition cursor-pointer"
              title="Reset checklist"
            >
              <RotateCcw size={13} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Real-time Comfort Assessment Banner */}
      <div className={`mt-5 rounded-xl border p-4 transition-all ${status.style}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {isSevereHeat ? (
              <Flame size={22} className="text-red-600 animate-pulse" />
            ) : isModerateHeat ? (
              <AlertTriangle size={22} className="text-amber-600" />
            ) : isCold ? (
              <ThermometerSnowflake size={22} className="text-blue-600" />
            ) : isOptimal ? (
              <CheckCircle2 size={22} className="text-emerald-600" />
            ) : (
              <Info size={22} className="text-slate-500" />
            )}
            <div>
              <p className="text-sm font-bold tracking-tight">{status.title}</p>
              <p className="text-xs text-slate-600 mt-0.5">{status.desc}</p>
            </div>
          </div>

          {/* Quick Telemetry Benchmark Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-2.5 py-1 font-medium text-slate-700 shadow-xs">
              <Thermometer size={13} className="text-orange-500" />
              {temperature}°C
              <span className="text-[10px] text-slate-400">(Ideal 18–24°C)</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-2.5 py-1 font-medium text-slate-700 shadow-xs">
              <Droplets size={13} className="text-blue-500" />
              {humidity}%
              <span className="text-[10px] text-slate-400">(Ideal 50–70%)</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-2.5 py-1 font-medium text-slate-700 shadow-xs">
              <Wind size={13} className="text-purple-500" />
              HI: {heatIndex}°C
            </span>
          </div>
        </div>
      </div>

      {/* Suggestion Cards Grid */}
      <div className="mt-5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {suggestions.map((item) => {
          const Icon = item.icon;
          const isDone = Boolean(completedActions[item.id]);

          const badgeClasses = {
            danger: 'bg-red-100 text-red-800 border-red-200',
            warning: 'bg-amber-100 text-amber-800 border-amber-200',
            info: 'bg-blue-100 text-blue-800 border-blue-200',
            optimal: 'bg-emerald-100 text-emerald-800 border-emerald-200'
          }[item.badge.variant];

          return (
            <div
              key={item.id}
              onClick={() => toggleAction(item.id)}
              className={`group relative flex flex-col justify-between rounded-xl border p-4 transition-all cursor-pointer select-none ${
                isDone
                  ? 'border-emerald-200 bg-emerald-50/40 opacity-75'
                  : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`rounded-lg p-2 transition ${
                        isDone
                          ? 'bg-emerald-100 text-emerald-700'
                          : item.badge.variant === 'danger'
                          ? 'bg-red-50 text-red-600'
                          : item.badge.variant === 'warning'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      <Icon size={18} />
                    </div>
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${badgeClasses}`}>
                      {item.badge.label}
                    </span>
                  </div>

                  {/* Interactive Checkbox */}
                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${
                      isDone
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-slate-300 bg-white group-hover:border-blue-400'
                    }`}
                  >
                    {isDone && <CheckCircle2 size={14} className="stroke-[3]" />}
                  </div>
                </div>

                <h3 className={`mt-3 text-sm font-bold transition ${isDone ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                  {item.title}
                </h3>

                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  {item.action}
                </p>
              </div>

              {/* Research / Science Note */}
              <div className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-500 border border-slate-100">
                <span className="font-semibold text-slate-700">Research Note: </span>
                {item.scienceNote}
              </div>
            </div>
          );
        })}
      </div>

      {/* Collapsible Poultry Science Quick Reference Guide */}
      <div className="mt-5 border-t border-slate-100 pt-4">
        <button
          onClick={() => setShowScienceGuide((prev) => !prev)}
          className="flex w-full items-center justify-between text-xs font-semibold text-slate-500 hover:text-slate-800 transition cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <BookOpen size={14} className="text-blue-500" />
            Poultry Science Thermal Comfort Reference (Broilers & Layers)
          </span>
          {showScienceGuide ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {showScienceGuide && (
          <div className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-white p-3 border border-slate-200/80 shadow-2xs">
              <p className="font-bold text-emerald-700">18°C – 24°C (Comfort)</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Thermal neutral zone. Optimal feed conversion ratio (FCR), normal respiration (20–25 breaths/min), calm flock distribution.
              </p>
            </div>
            <div className="rounded-lg bg-white p-3 border border-slate-200/80 shadow-2xs">
              <p className="font-bold text-amber-700">25°C – 29°C (Mild Strain)</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Mild panting begins. Feed intake drops 5–10%; water intake rises 20–40%. Needs air velocity (&gt;1.0 m/s) to avoid heat accumulation.
              </p>
            </div>
            <div className="rounded-lg bg-white p-3 border border-slate-200/80 shadow-2xs">
              <p className="font-bold text-red-700">≥ 30°C (Critical Heat Stress)</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Heavy gular panting (&gt;100 bpm), wing drooping, respiratory alkalosis. Water flush and electrolyte addition essential to stop mortality.
              </p>
            </div>
            <div className="rounded-lg bg-white p-3 border border-slate-200/80 shadow-2xs">
              <p className="font-bold text-blue-700">50% – 70% RH Rule</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                At &gt;75% humidity, never mist! Chickens cannot evaporate panting moisture in saturated air. At &lt;45% RH, misting cools air by 4–7°C.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
