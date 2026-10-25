import React, { useState, useRef } from 'react';
import { 
  PhoneCall, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  UtensilsCrossed, 
  Database,
  Layers, 
  Target, 
  HelpCircle,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { TopBar } from './components/TopBar';
import { VoiceCallPanel } from './components/VoiceCallPanel';
import { PipelineInspector } from './components/PipelineInspector';
import { DatabaseExplorer } from './components/DatabaseExplorer';
import { BenchmarkView } from './components/BenchmarkView';
import { ArchitectureDeepDive } from './components/ArchitectureDeepDive';
import { AgentTurnResponse } from './types';

export default function App() {
  const [activeSection, setActiveSection] = useState('agent');
  const [isCallActive, setIsCallActive] = useState(false);
  const [latestResponse, setLatestResponse] = useState<AgentTurnResponse | null>(null);
  const [lastUserPrompt, setLastUserPrompt] = useState<string>('');

  const agentRef = useRef<HTMLDivElement>(null);
  const pipelineRef = useRef<HTMLDivElement>(null);
  const databaseRef = useRef<HTMLDivElement>(null);
  const benchmarkRef = useRef<HTMLDivElement>(null);
  const deepdiveRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    let targetEl: HTMLElement | null = null;
    if (sectionId === 'agent') targetEl = agentRef.current;
    if (sectionId === 'pipeline') targetEl = pipelineRef.current;
    if (sectionId === 'database') targetEl = databaseRef.current;
    if (sectionId === 'benchmark') targetEl = benchmarkRef.current;
    if (sectionId === 'deepdive') targetEl = deepdiveRef.current;

    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleTurnComplete = (response: AgentTurnResponse, promptText: string) => {
    setLatestResponse(response);
    setLastUserPrompt(promptText);
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950">
      {/* Top Bar Navigation */}
      <TopBar
        activeSection={activeSection}
        onNavigate={scrollToSection}
        isCallActive={isCallActive}
        onToggleCall={() => setIsCallActive(!isCallActive)}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
        {/* Hero & Phone Handset Two-Column Split */}
        <section ref={agentRef} className="pt-2">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Hospitality Context & Architecture Scope */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono text-amber-400">
                  <span>Project 02</span>
                  <span aria-hidden="true">·</span>
                  <span>Autonomous Phone Concierge</span>
                  <span aria-hidden="true">·</span>
                  <span>Trattoria Bella</span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-stone-100 tracking-tight leading-[1.15] text-balance">
                  Real-time voice agent with tool calling & strict allergen guardrails.
                </h1>

                <p className="text-sm sm:text-base text-stone-300 leading-relaxed max-w-2xl">
                  Simulate live customer phone calls to <strong>Sophia</strong> with sub-second turnaround latency, 
                  multi-intent parallel SQLite tool execution, Levenshtein fuzzy speech error recovery, and 
                  an uncompromised fail-closed allergen safety guardrail.
                </p>
              </div>

              {/* Action Strip */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={() => setIsCallActive(true)}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold tracking-wide transition-all shadow-lg shadow-amber-950/40 cursor-pointer flex items-center gap-2"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Start Autonomous Voice Call</span>
                </button>

                <button
                  onClick={() => scrollToSection('benchmark')}
                  className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 border border-stone-800 hover:border-stone-700 text-stone-300 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Target className="w-3.5 h-3.5 text-amber-400" />
                  <span>View Benchmark Suite</span>
                </button>

                <button
                  onClick={() => scrollToSection('deepdive')}
                  className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 border border-stone-800 hover:border-stone-700 text-stone-300 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>"Does every part need an LLM?"</span>
                </button>
              </div>

              {/* High-Fidelity Restaurant Ambient Backdrop Preview */}
              <div className="relative rounded-xl overflow-hidden border border-stone-800/80 group">
                <img
                  src="/src/assets/images/restaurant_trattoria_interior_1792918315717.jpg"
                  alt="Trattoria Bella Dining Room"
                  referrerPolicy="no-referrer"
                  className="w-full h-48 sm:h-56 object-cover brightness-[0.75] group-hover:scale-[1.02] transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-transparent p-5 flex flex-col justify-end">
                  <div className="flex items-center justify-between text-xs text-stone-200">
                    <span className="font-serif text-sm font-semibold text-amber-200">Trattoria Bella · Florence</span>
                    <span className="font-mono text-[11px] text-stone-400">Live Voice Agent Demo</span>
                  </div>
                  <p className="text-[11px] text-stone-300 mt-1 max-w-lg">
                    Real-time reservation system checking 2, 4, and 8-seat table availability and preventing kitchen allergen liabilities.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Interactive Phone Handset & Audio Visualizer */}
            <div className="lg:col-span-5 sticky top-20">
              <VoiceCallPanel
                isCallActive={isCallActive}
                onStartCall={() => setIsCallActive(true)}
                onEndCall={() => setIsCallActive(false)}
                onTurnComplete={handleTurnComplete}
                latestResponse={latestResponse}
              />
            </div>
          </div>
        </section>

        {/* 4-Column Tabular Telemetry Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 py-2 border-y border-stone-800">
          <div className="space-y-1">
            <div className="text-[11px] text-stone-400 uppercase tracking-wider font-mono">Turnaround Latency</div>
            <div className="text-xl font-bold font-mono text-amber-400 tabular-nums">
              {latestResponse ? `${latestResponse.latencyMs} ms` : '< 420 ms'}
            </div>
            <p className="text-[11px] text-stone-400">Speech end to first audio token</p>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] text-stone-400 uppercase tracking-wider font-mono">Allergen Safety</div>
            <div className="text-xl font-bold font-mono text-emerald-400">
              100% Fail-Closed
            </div>
            <p className="text-[11px] text-stone-400">Zero inference on unverified items</p>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] text-stone-400 uppercase tracking-wider font-mono">Active Floor Capacity</div>
            <div className="text-xl font-bold font-mono text-stone-200 tabular-nums">
              22 Seats (6 Tables)
            </div>
            <p className="text-[11px] text-stone-400">SQLite availability check</p>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] text-stone-400 uppercase tracking-wider font-mono">STT Error Recovery</div>
            <div className="text-xl font-bold font-mono text-indigo-400">
              Levenshtein
            </div>
            <p className="text-[11px] text-stone-400">Fuzzy dish phonetic correction</p>
          </div>
        </section>

        {/* Section 1: Event-Driven Pipeline Inspector */}
        <section ref={pipelineRef} className="scroll-mt-20">
          <PipelineInspector
            latestResponse={latestResponse}
            lastUserQuery={lastUserPrompt}
          />
        </section>

        {/* Section 2: Local SQLite Database Explorer */}
        <section ref={databaseRef} className="scroll-mt-20">
          <DatabaseExplorer />
        </section>

        {/* Section 3: Evaluation Benchmark Suite */}
        <section ref={benchmarkRef} className="scroll-mt-20">
          <BenchmarkView />
        </section>

        {/* Section 4: Architectural Deep-Dive & Interview Pitch */}
        <section ref={deepdiveRef} className="scroll-mt-20">
          <ArchitectureDeepDive />
        </section>
      </main>

      {/* Clean, quiet footer */}
      <footer className="border-t border-stone-800 bg-stone-950 py-6 text-stone-500 text-xs mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-serif font-semibold text-stone-300">Trattoria Bella</span>
            <span aria-hidden="true">·</span>
            <span>Real-Time Voice AI Agent with Tool Calling & Allergen Guardrail</span>
          </div>
          <div className="font-mono text-[11px] text-stone-400">
            Node.js + Express · SQLite (sql.js) · Gemini 3.8 Flash & Lite TTS
          </div>
        </div>
      </footer>
    </div>
  );
}
