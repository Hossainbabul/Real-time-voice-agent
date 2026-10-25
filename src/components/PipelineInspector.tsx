import React from 'react';
import { 
  Cpu, 
  Database, 
  ShieldCheck, 
  Volume2, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  ArrowRight,
  GitBranch,
  Timer
} from 'lucide-react';
import { AgentTurnResponse } from '../types';

interface PipelineInspectorProps {
  latestResponse: AgentTurnResponse | null;
  lastUserQuery: string;
}

export const PipelineInspector: React.FC<PipelineInspectorProps> = ({
  latestResponse,
  lastUserQuery,
}) => {
  const pipelineSteps = [
    { num: '01', name: 'STT Engine', desc: 'Audio Stream to Text String' },
    { num: '02', name: 'Orchestrator', desc: 'Multi-Intent Parser' },
    { num: '03', name: 'Tool Calling', desc: 'Parallel SQLite Functions' },
    { num: '04', name: 'Guardrail Layer', desc: 'Fail-Closed Safety Check' },
    { num: '05', name: 'Concise LLM', desc: '<25 Words Phone Synthesis' },
    { num: '06', name: 'TTS Engine', desc: '24kHz Spoken Voice Audio' },
  ];

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-800">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-500" />
            <h2 className="text-base font-semibold text-stone-100">
              Event-Driven Pipeline & Tool Calling Inspector
            </h2>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Real-time inspection of intent parsing, parallel SQLite tool execution, and fail-closed allergen guardrails.
          </p>
        </div>

        {latestResponse && (
          <div className="flex items-center gap-4 text-xs font-mono text-stone-300">
            <div className="flex items-center gap-1.5 bg-stone-950 px-3 py-1.5 rounded-md border border-stone-800">
              <Timer className="w-3.5 h-3.5 text-amber-400" />
              <span>Turnaround:</span>
              <span className="text-amber-400 font-semibold tabular-nums">{latestResponse.latencyMs} ms</span>
            </div>
            <div className="flex items-center gap-1.5 bg-stone-950 px-3 py-1.5 rounded-md border border-stone-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Guardrail:</span>
              <span className={latestResponse.guardrailPassed ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                {latestResponse.guardrailPassed ? 'PASS (FAIL-CLOSED)' : 'FAIL'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Visual Pipeline Flow */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {pipelineSteps.map((step, idx) => (
          <div 
            key={step.num}
            className="bg-stone-950/70 border border-stone-800/90 rounded-lg p-2.5 relative group hover:border-amber-600/40 transition-colors"
          >
            <div className="flex items-center justify-between text-[10px] text-amber-500/80 font-mono mb-1">
              <span>{step.num}</span>
              {idx < 5 && <ArrowRight className="w-2.5 h-2.5 text-stone-600 hidden md:block" />}
            </div>
            <h4 className="text-xs font-semibold text-stone-200 truncate">{step.name}</h4>
            <p className="text-[10px] text-stone-400 mt-0.5 leading-tight">{step.desc}</p>
          </div>
        ))}
      </div>

      {/* Live Turn Trace Content */}
      {latestResponse ? (
        <div className="space-y-4">
          {/* Step 1 & 2: User Input & Multi-Intent Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-stone-950/90 rounded-lg p-4 border border-stone-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-stone-400">
                <span className="font-semibold text-stone-300">01. STT Transcribed Query</span>
                <span className="font-mono text-stone-500">Audio In</span>
              </div>
              <p className="text-xs text-stone-200 font-mono bg-stone-900/90 p-2.5 rounded border border-stone-800 leading-relaxed">
                "{lastUserQuery || 'No input'}"
              </p>
            </div>

            <div className="bg-stone-950/90 rounded-lg p-4 border border-stone-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-stone-400">
                <span className="font-semibold text-stone-300">02. Intent Extraction & Parallel Routing</span>
                <span className="font-mono text-amber-400">
                  {latestResponse.multiIntentDetected ? 'Multi-Intent (Parallel)' : 'Single Intent'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {latestResponse.toolCalls.map((t, i) => (
                  <span 
                    key={i}
                    className="bg-stone-900 text-stone-300 border border-stone-700 px-2.5 py-1 rounded font-mono text-[11px] flex items-center gap-1.5"
                  >
                    <GitBranch className="w-3 h-3 text-amber-400" />
                    <span>{t.toolName}()</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Step 3: Tool Execution Details (SQLite queries) */}
          <div className="bg-stone-950/90 rounded-lg p-4 border border-stone-800 space-y-3">
            <div className="flex items-center justify-between text-[11px] text-stone-400">
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-semibold text-stone-300">03. Tool Execution Details (SQLite Layer)</span>
              </div>
              <span className="text-stone-500 text-[10px]">Pure SQL & Table Logic · Zero LLM Math</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {latestResponse.toolCalls.map((trace, idx) => (
                <div 
                  key={idx}
                  className="bg-stone-900/90 border border-stone-800 rounded-lg p-3 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between border-b border-stone-800 pb-1.5">
                    <span className="font-mono font-semibold text-amber-300 text-[11px]">
                      {trace.toolName}
                    </span>
                    <span className="font-mono text-[10px] text-stone-400">
                      {trace.executionMs} ms
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider block mb-0.5">Parameters:</span>
                    <pre className="font-mono text-[11px] text-stone-300 bg-stone-950 p-1.5 rounded overflow-x-auto">
                      {JSON.stringify(trace.args, null, 2)}
                    </pre>
                  </div>

                  <div>
                    <span className="text-[10px] text-stone-400 uppercase tracking-wider block mb-0.5">Output Data:</span>
                    <pre className="font-mono text-[11px] text-emerald-300 bg-stone-950 p-1.5 rounded overflow-x-auto">
                      {JSON.stringify(trace.output, null, 2)}
                    </pre>
                  </div>

                  {trace.guardrailEvaluated && (
                    <div className="pt-1 border-t border-stone-800 flex items-center justify-between text-[10px]">
                      <span className="text-stone-400">Guardrail Verdict:</span>
                      <span className={`font-mono font-medium ${trace.guardrailStatus?.includes('PASS') ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {trace.guardrailStatus}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step 4 & 5: Guardrail Layer & Final Spoken Voice Synthesis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-stone-950/90 rounded-lg p-4 border border-stone-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-stone-400">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>04. Safety Guardrail Audit Note</span>
                </div>
                <span className="font-mono text-[10px] text-stone-500">Fail-Closed Invariant</span>
              </div>
              <p className="text-xs text-stone-300 bg-stone-900/80 p-2.5 rounded border border-stone-800 leading-relaxed font-sans">
                {latestResponse.guardrailAuditNote}
              </p>
            </div>

            <div className="bg-stone-950/90 rounded-lg p-4 border border-stone-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-stone-400">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>05 & 06. Synthesized Spoken Output</span>
                </div>
                <span className="font-mono text-stone-400 tabular-nums">
                  {latestResponse.spokenText.split(' ').length} words (&lt;25 target)
                </span>
              </div>
              <p className="text-xs text-amber-100 font-serif bg-stone-900/80 p-2.5 rounded border border-stone-800 leading-relaxed">
                "{latestResponse.spokenText}"
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-stone-950/50 rounded-lg p-8 border border-stone-800 text-center space-y-2">
          <Layers className="w-8 h-8 text-stone-600 mx-auto" />
          <p className="text-xs text-stone-400 font-medium">
            Pipeline trace is currently idle. Speak into the phone or click a test scenario to inspect live tool execution!
          </p>
        </div>
      )}
    </div>
  );
};
