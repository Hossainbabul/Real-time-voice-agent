import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  PhoneOff, 
  Send, 
  Volume2, 
  VolumeX, 
  HandMetal, 
  Clock, 
  ShieldCheck, 
  Sparkles,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AgentTurnResponse } from '../types';

interface VoiceCallPanelProps {
  isCallActive: boolean;
  onStartCall: () => void;
  onEndCall: () => void;
  onTurnComplete: (response: AgentTurnResponse, userPrompt: string) => void;
  latestResponse: AgentTurnResponse | null;
}

export const VoiceCallPanel: React.FC<VoiceCallPanelProps> = ({
  isCallActive,
  onStartCall,
  onEndCall,
  onTurnComplete,
  latestResponse,
}) => {
  const [callState, setCallState] = useState<'IDLE' | 'CONNECTING' | 'LISTENING' | 'THINKING' | 'SPEAKING'>('IDLE');
  const [inputText, setInputText] = useState('');
  const [isMicListening, setIsMicListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [useGeminiTts, setUseGeminiTts] = useState(true);
  const [sttSupported, setSttSupported] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<any>(null);

  // Quick prompt scenarios
  const promptScenarios = [
    {
      label: 'Multi-Intent Booking + Allergen',
      text: 'Table for 4 at 7:00 PM and does the pesto pasta have nuts?',
      badge: 'Parallel Tools'
    },
    {
      label: 'Fail-Closed: Unverified Risotto',
      text: 'Is the Truffle Mushroom Risotto safe for someone with dairy allergies?',
      badge: 'Fail-Closed'
    },
    {
      label: 'STT Fuzzy Error (Presto -> Pesto)',
      text: 'Does the Presto pasta have nuts or pine nuts?',
      badge: 'Levenshtein'
    },
    {
      label: 'Slot Conflict (19:30 Clash)',
      text: 'Table for 4 at 19:30 tonight please.',
      badge: 'Alternative Slot'
    },
    {
      label: 'Finalize Reservation',
      text: 'Please confirm and book for 2 at 8:00 PM under Marco Rossi',
      badge: 'DB Insert'
    }
  ];

  // Call duration counter
  useEffect(() => {
    if (isCallActive) {
      setCallState('CONNECTING');
      const timer = setTimeout(() => {
        setCallState('LISTENING');
        speakText("Buongiorno! You've reached Trattoria Bella. I'm Sophia, your phone concierge. How may I assist you today?");
      }, 1000);

      timerIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

      return () => {
        clearTimeout(timer);
        clearInterval(timerIntervalRef.current);
      };
    } else {
      setCallState('IDLE');
      setCallDuration(0);
      stopAudioPlayback();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  }, [isCallActive]);

  // Web Speech STT initialization
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsMicListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setInputText(transcript);

        if (event.results[0].isFinal) {
          handleSendQuery(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsMicListening(false);
      };

      recognition.onend = () => {
        setIsMicListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setSttSupported(false);
    }
  }, []);

  // Audio waveform animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const renderWave = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      const isSpeaking = callState === 'SPEAKING';
      const isListening = callState === 'LISTENING' && isMicListening;
      const isThinking = callState === 'THINKING';

      // Base amplitude
      let amp = 2;
      let strokeColor = 'rgba(168, 162, 158, 0.3)'; // stone-400

      if (isSpeaking) {
        amp = 18 + Math.sin(phase * 4) * 8;
        strokeColor = 'rgba(245, 158, 11, 0.9)'; // amber-500
      } else if (isListening) {
        amp = 12 + Math.random() * 8;
        strokeColor = 'rgba(16, 185, 129, 0.9)'; // emerald-500
      } else if (isThinking) {
        amp = 6 + Math.sin(phase * 2) * 4;
        strokeColor = 'rgba(99, 102, 241, 0.8)'; // indigo-500
      }

      ctx.beginPath();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = strokeColor;

      for (let x = 0; x < width; x++) {
        const freq = 0.035;
        const y = centerY + Math.sin(x * freq + phase) * amp * Math.sin((x / width) * Math.PI);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Second harmonic wave for depth
      if (isSpeaking || isListening) {
        ctx.beginPath();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = isSpeaking ? 'rgba(217, 119, 6, 0.4)' : 'rgba(5, 150, 105, 0.4)';
        for (let x = 0; x < width; x++) {
          const y = centerY + Math.sin(x * 0.05 - phase * 1.5) * (amp * 0.6) * Math.sin((x / width) * Math.PI);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      phase += 0.08;
      animationFrameRef.current = requestAnimationFrame(renderWave);
    };

    renderWave();
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [callState, isMicListening]);

  // Trigger mic toggle
  const toggleMic = () => {
    if (!isCallActive) {
      onStartCall();
      return;
    }

    if (isMicListening) {
      recognitionRef.current?.stop();
      setIsMicListening(false);
    } else {
      // If agent is speaking, speaking into mic interrupts Sophia (Barge-in)
      if (callState === 'SPEAKING') {
        handleInterrupt();
      }
      try {
        recognitionRef.current?.start();
        setIsMicListening(true);
      } catch (err) {
        console.warn('Recognition start error:', err);
      }
    }
  };

  // Failure Mode 1: Interruption / Barge-in
  const handleInterrupt = () => {
    stopAudioPlayback();
    setCallState('LISTENING');
  };

  const stopAudioPlayback = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (currentAudioSourceRef.current) {
      try {
        currentAudioSourceRef.current.stop();
      } catch (e) {
        // already stopped
      }
      currentAudioSourceRef.current = null;
    }
  };

  // Spoken audio synthesis (Gemini TTS with Web Speech fallback)
  const speakText = async (text: string) => {
    if (isMuted) return;
    stopAudioPlayback();
    setCallState('SPEAKING');

    if (useGeminiTts) {
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        const data = await res.json();

        if (data.audioBase64) {
          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          const ctx = audioContextRef.current;
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }

          const binary = atob(data.audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }

          const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          currentAudioSourceRef.current = source;

          source.onended = () => {
            setCallState('LISTENING');
            currentAudioSourceRef.current = null;
          };

          source.start();
          return;
        }
      } catch (err) {
        console.warn('Gemini TTS failed, falling back to Web Speech Synthesis:', err);
      }
    }

    // Web Speech fallback
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';

      // Pick natural female voice if available
      const voices = window.speechSynthesis.getVoices();
      const naturalVoice = voices.find(v => 
        (v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Google') || v.name.includes('Female')) && 
        v.lang.startsWith('en')
      );
      if (naturalVoice) utterance.voice = naturalVoice;

      utterance.onend = () => {
        setCallState('LISTENING');
      };
      utterance.onerror = () => {
        setCallState('LISTENING');
      };

      window.speechSynthesis.speak(utterance);
    } else {
      setCallState('LISTENING');
    }
  };

  // Main interaction sender
  const handleSendQuery = async (queryToSend?: string) => {
    const text = queryToSend || inputText;
    if (!text.trim()) return;

    if (!isCallActive) {
      onStartCall();
    }

    // Stop speaking if customer speaks
    stopAudioPlayback();
    setCallState('THINKING');
    setInputText('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!res.ok) throw new Error('API turn failed');
      const data: AgentTurnResponse = await res.json();

      onTurnComplete(data, text);

      // If reservation confirmed, trigger celebration confetti
      if (data.bookingConfirmed) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 }
        });
      }

      // Speak response
      speakText(data.spokenText);
    } catch (err) {
      console.error('Turn error:', err);
      setCallState('LISTENING');
      speakText("Our phone connection stuttered for a moment. Could you please repeat that?");
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden shadow-2xl transition-all">
      {/* Handset Header */}
      <div className="bg-stone-950 px-5 py-3 border-b border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-amber-500/40 shrink-0 bg-stone-800">
            <img 
              src="/src/assets/images/concierge_sophia_avatar_1792918314066.jpg" 
              alt="Sophia Concierge" 
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover" 
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-stone-100">Sophia</h3>
              <span className="text-[11px] text-amber-400 font-mono">Trattoria Bella Concierge</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-400">
              <span className="font-mono tabular-nums">{formatDuration(callDuration)}</span>
              <span aria-hidden="true">·</span>
              <span className={`font-medium ${
                callState === 'SPEAKING' ? 'text-amber-400' :
                callState === 'THINKING' ? 'text-indigo-400' :
                callState === 'LISTENING' ? 'text-emerald-400' :
                callState === 'CONNECTING' ? 'text-amber-300' : 'text-stone-500'
              }`}>
                {callState === 'IDLE' && 'Call Idle'}
                {callState === 'CONNECTING' && 'Connecting Line...'}
                {callState === 'LISTENING' && 'Listening to Customer'}
                {callState === 'THINKING' && 'Calling SQLite Tools...'}
                {callState === 'SPEAKING' && 'Speaking over Phone'}
              </span>
            </div>
          </div>
        </div>

        {/* Audio controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? 'Unmute Agent' : 'Mute Agent'}
            className="p-1.5 text-stone-400 hover:text-stone-200 rounded-md hover:bg-stone-800 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {isCallActive && (
            <button
              onClick={onEndCall}
              className="px-2.5 py-1 text-xs font-medium bg-red-950/80 hover:bg-red-900 border border-red-800/60 text-red-200 rounded-md transition-colors flex items-center gap-1.5"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>Hang Up</span>
            </button>
          )}
        </div>
      </div>

      {/* Handset Body */}
      <div className="p-5 space-y-4">
        {/* Real-time Waveform Canvas */}
        <div className="bg-stone-950/90 rounded-lg p-3 border border-stone-800/80 relative">
          <div className="flex items-center justify-between text-[11px] text-stone-400 mb-1">
            <span className="tracking-wide">Audio Frequency Stream</span>
            {latestResponse && (
              <span className="font-mono text-amber-400 tabular-nums">
                Latency: {latestResponse.latencyMs} ms
              </span>
            )}
          </div>
          <canvas 
            ref={canvasRef} 
            width={480} 
            height={68} 
            className="w-full h-[68px] block" 
          />

          {/* Barge-in / Interruption Button (Failure Mode 1) */}
          {callState === 'SPEAKING' && (
            <button
              onClick={handleInterrupt}
              className="absolute right-3 bottom-3 px-2.5 py-1 text-[11px] font-medium bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 rounded flex items-center gap-1 transition-all shadow-sm cursor-pointer"
            >
              <HandMetal className="w-3 h-3 text-amber-400" />
              <span>Barge-In (Interrupt Agent)</span>
            </button>
          )}
        </div>

        {/* Latest Spoken Bubbles */}
        <div className="space-y-2.5 min-h-[90px] max-h-[140px] overflow-y-auto pr-1">
          {latestResponse ? (
            <div className="bg-stone-800/60 rounded-lg p-3 border border-stone-700/50">
              <div className="flex items-center justify-between text-[11px] text-stone-400 mb-1">
                <span className="font-semibold text-amber-300">Sophia (Phone Response)</span>
                <span className="font-mono text-stone-400">{latestResponse.spokenText.split(' ').length} words</span>
              </div>
              <p className="text-sm text-stone-100 font-sans leading-relaxed">
                "{latestResponse.spokenText}"
              </p>
            </div>
          ) : (
            <div className="bg-stone-800/30 rounded-lg p-3 border border-dashed border-stone-800 text-center text-xs text-stone-400">
              {isCallActive 
                ? "Sophia is connected and listening. Speak or select a scenario below." 
                : "Click 'Call Sophia' or any scenario below to start an autonomous phone conversation."}
            </div>
          )}
        </div>

        {/* Live Input Controls */}
        <div className="space-y-3 pt-1">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSendQuery(); }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={toggleMic}
              title={isMicListening ? "Stop Microphone" : "Speak via Microphone"}
              className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                isMicListening 
                  ? 'bg-emerald-600 text-white border-emerald-500 animate-pulse' 
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-stone-700'
              }`}
            >
              {isMicListening ? <Mic className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isMicListening ? "Listening to your voice..." : "Say: 'Table for 4 at 7pm and does pesto have nuts?'"}
              className="flex-1 bg-stone-950 border border-stone-700 rounded-lg px-3.5 py-2 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 transition-colors"
            />

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="p-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-lg transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Scenario Buttons */}
          <div>
            <div className="text-[11px] font-medium text-stone-400 mb-1.5 flex items-center justify-between">
              <span>Test Scenarios (1-Click Multi-Intent & Guardrails)</span>
              <span className="text-[10px] text-stone-500">Fast Evaluator</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {promptScenarios.map((sc, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendQuery(sc.text)}
                  className="text-left text-[11px] px-2.5 py-1.5 bg-stone-800/80 hover:bg-stone-800 border border-stone-700 hover:border-amber-600/50 rounded-md text-stone-300 hover:text-amber-200 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span className="text-amber-400 font-mono text-[9px] uppercase tracking-wider">{sc.badge}</span>
                  <span className="truncate max-w-[210px]">{sc.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Handset Footer Telemetry */}
      <div className="bg-stone-950/80 px-5 py-2.5 border-t border-stone-800 text-[11px] text-stone-400 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-stone-300">
            <input 
              type="checkbox" 
              checked={useGeminiTts} 
              onChange={(e) => setUseGeminiTts(e.target.checked)} 
              className="accent-amber-500 rounded text-xs" 
            />
            <span>Gemini Flash Lite TTS</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <span>Fail-Closed Safety:</span>
          <span className="text-emerald-400 font-mono font-medium">STRICT ACTIVE</span>
        </div>
      </div>
    </div>
  );
};
