import React from 'react';
import { 
  HelpCircle, 
  Check, 
  X, 
  ShieldAlert, 
  Workflow, 
  AlertOctagon, 
  Volume2, 
  Database,
  ArrowRight
} from 'lucide-react';

export const ArchitectureDeepDive: React.FC = () => {
  const architecturalDecisions = [
    {
      subsystem: 'Natural Speech Parsing & Multi-Intent Extraction',
      layer: 'LLM Orchestrator',
      isLlmAllowed: true,
      rationale: 'Natural human speech over the phone is unstructured, variable, and often combines multiple requests (e.g. reserving a table AND inquiring about pine nuts in one sentence). LLMs excel at parameter extraction.',
      riskWithoutLlm: 'Brittle regex or hardcoded rule engines fail whenever customer uses colloquial speech or varied phrasing.'
    },
    {
      subsystem: 'Table Availability & Capacity Calculations',
      layer: 'Relational SQLite Engine',
      isLlmAllowed: false,
      rationale: 'Pure arithmetic and SQL aggregation. Whether a 4-seater is occupied at 19:30 is a deterministic binary constraint that can be queried in <1ms.',
      riskWithLlm: 'Hallucination: LLM creates double bookings, phantom tables, or promises seats that do not exist.'
    },
    {
      subsystem: 'Allergen Safety Verification & Guardrail',
      layer: 'Hardcoded Fail-Closed Guardrail',
      isLlmAllowed: false,
      rationale: 'Severe legal and life-safety liability (anaphylaxis). If dish allergen status is UNVERIFIED, NULL, or missing, code MUST fail-closed with zero inference.',
      riskWithLlm: 'Catastrophic Safety Failure: LLM assumes pesto or risotto is safe based on general culinary knowledge, risking medical emergency.'
    },
    {
      subsystem: 'Conversational Voice Synthesis (<25 words)',
      layer: 'Concise LLM Persona',
      isLlmAllowed: true,
      rationale: 'Generates warm, courteous, and polite Italian hospitality replies suited for phone acoustics while maintaining word counts strictly under 25 words.',
      riskWithoutLlm: 'Mechanical robotic audio prompts that degrade user trust and customer satisfaction.'
    },
    {
      subsystem: 'Speech Transcription Fuzzy Correction',
      layer: 'Classical Levenshtein Algorithm',
      isLlmAllowed: false,
      rationale: 'Levenshtein edit distance deterministically maps noisy phonetics ("Presto" -> "Pesto Pasta") in O(N*M) with zero token cost or LLM latency.',
      riskWithLlm: 'High token latency and erratic spelling guesses when a deterministic string metric solves it instantly.'
    }
  ];

  const failureModes = [
    {
      id: '01',
      title: 'User Interruption (Barge-In)',
      scenario: 'Customer speaks while the AI voice agent is in mid-sentence.',
      mechanism: 'Instantly abort ongoing audio stream, truncate AudioBufferSourceNode, and reset orchestrator to LISTENING state.',
      target: '< 50ms truncation latency'
    },
    {
      id: '02',
      title: 'STT Transcription Error Recovery',
      scenario: 'Speech engine transcribes "Pesto" as "Presto" or "Tagliolini" as "Tagliatel".',
      mechanism: 'Levenshtein edit distance metric queries menu items and auto-corrects to closest phonetic dish match before querying allergen table.',
      target: '100% resolution for edit distance <= 3'
    },
    {
      id: '03',
      title: 'Time Slot Conflict Negotiation',
      scenario: 'Customer requests a 4-person table at 19:30, which is fully booked.',
      mechanism: 'Agent does not simply reject; SQLite queries nearest available alternative (+30 min / 20:00) and proposes it in spoken reply.',
      target: 'Immediate proactive slot suggestion'
    },
    {
      id: '04',
      title: 'Database Failure / API Timeout',
      scenario: 'SQLite query locks or external AI API latency exceeds deadline.',
      mechanism: 'Circuit breaker falls back to polite receptionist fallback message asking customer to hold or speak with reception desk.',
      target: 'Zero crash & fail-safe fallback'
    }
  ];

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-6 space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-stone-800">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-amber-500" />
          <h2 className="text-base font-semibold text-stone-100">
            Architectural Trade-Off: "Does Every Part of the Problem Actually Need an LLM?"
          </h2>
        </div>
        <p className="text-xs text-stone-400 mt-1 max-w-3xl leading-relaxed">
          The defining difference between a toy demo and a production-grade voice agent lies in architectural boundaries: knowing precisely where to leverage LLMs and where to strictly forbid them.
        </p>
      </div>

      {/* Comparison Matrix Table */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 font-mono">
          System Boundary Decisions & Safety Segregation
        </h3>

        <div className="overflow-x-auto rounded-lg border border-stone-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-950 text-stone-400 uppercase text-[10px] tracking-wider border-b border-stone-800">
              <tr>
                <th className="py-3 px-4">Subsystem</th>
                <th className="py-3 px-4">Implementation Layer</th>
                <th className="py-3 px-4 text-center">LLM Permitted?</th>
                <th className="py-3 px-4">Architectural Rationale</th>
                <th className="py-3 px-4">Failure Risk If Violated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800 font-sans">
              {architecturalDecisions.map((dec, i) => (
                <tr key={i} className="hover:bg-stone-800/30 transition-colors">
                  <td className="py-3 px-4 font-medium text-stone-100 max-w-[200px]">
                    {dec.subsystem}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-stone-300">
                    {dec.layer}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {dec.isLlmAllowed ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-semibold">
                        <Check className="w-3.5 h-3.5" /> YES
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-red-400 font-semibold">
                        <X className="w-3.5 h-3.5" /> FORBIDDEN
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-stone-300 text-xs leading-relaxed max-w-sm">
                    {dec.rationale}
                  </td>
                  <td className="py-3 px-4 text-amber-300/90 text-xs leading-relaxed max-w-xs">
                    {dec.riskWithLlm || dec.riskWithoutLlm}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Production Failure Modes Grid */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 font-mono">
          Production Failure Modes & Recovery Mechanics
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {failureModes.map((fm) => (
            <div 
              key={fm.id}
              className="bg-stone-950/80 border border-stone-800 rounded-lg p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between border-b border-stone-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-amber-400 font-bold">{fm.id}</span>
                  <h4 className="text-xs font-semibold text-stone-200">{fm.title}</h4>
                </div>
                <span className="font-mono text-[10px] text-stone-500">{fm.target}</span>
              </div>

              <div>
                <span className="text-[10px] text-stone-500 uppercase tracking-wider block mb-0.5">Failure Scenario:</span>
                <p className="text-xs text-stone-300 font-sans leading-relaxed">
                  {fm.scenario}
                </p>
              </div>

              <div className="bg-stone-900/90 p-2.5 rounded border border-stone-800/80">
                <span className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider block mb-0.5">Production Recovery:</span>
                <p className="text-xs text-stone-200 font-sans leading-relaxed">
                  {fm.mechanism}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Interview Presentation Summary in Bengali & English */}
      <div className="bg-stone-950 p-5 rounded-lg border border-amber-900/40 space-y-3">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider font-mono">
          <Workflow className="w-4 h-4" />
          <span>Interview Answer Cheat Sheet (ইন্টারভিউ প্রেজেন্টেশন নোট)</span>
        </div>
        <p className="text-xs text-stone-300 leading-relaxed">
          "একটি সাধারণ চ্যাটবট এবং এন্টারপ্রাইজ ভয়েস এজেন্টের পার্থক্য তৈরি হয় সেফটি বাউন্ডারিতে। 
          আমরা এলএলএম ব্যবহার করি কেবল <strong>Unstructured Speech Comprehension</strong> এবং <strong>Natural Language Generation</strong>-এর জন্য। 
          কিন্তু টেবিল হিসাব বা অ্যালার্জি সেফটিতে এলএলএম ব্যবহার করা নিষিদ্ধ—সেগুলো পিওর <strong>Deterministic SQL</strong> এবং <strong>Fail-Closed Guardrails</strong> দিয়ে সুরক্ষিত।"
        </p>
      </div>
    </div>
  );
};
