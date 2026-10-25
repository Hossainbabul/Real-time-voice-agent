import React from 'react';
import { PhoneCall, PhoneOff } from 'lucide-react';

interface TopBarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  isCallActive: boolean;
  onToggleCall: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  onNavigate,
  isCallActive,
  onToggleCall,
}) => {
  const navItems = [
    { id: 'agent', label: 'Live Voice Concierge' },
    { id: 'pipeline', label: 'Event Architecture' },
    { id: 'database', label: 'SQLite Database' },
    { id: 'benchmark', label: 'Evaluation Metrics' },
    { id: 'deepdive', label: 'Architectural Analysis' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-stone-900/95 backdrop-blur-md border-b border-stone-800 text-stone-100 px-6 py-3.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
        {/* Zone 1: Single text brand wordmark */}
        <button
          onClick={() => onNavigate('agent')}
          className="text-left group cursor-pointer focus:outline-none"
        >
          <span className="font-serif text-xl tracking-tight text-amber-100 group-hover:text-amber-200 transition-colors whitespace-nowrap shrink-0">
            Trattoria Bella
          </span>
        </button>

        {/* Zone 2: 4-5 clean single-line text navigation links */}
        <nav className="hidden lg:flex items-center gap-7 text-xs font-medium tracking-wide text-stone-400">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer py-1 ${
                activeSection === item.id
                  ? 'text-amber-300 border-b border-amber-300 font-semibold'
                  : 'hover:text-stone-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onToggleCall}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-medium tracking-wide rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              isCallActive
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-900/50'
                : 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm shadow-amber-950/40'
            }`}
          >
            {isCallActive ? (
              <>
                <PhoneOff className="w-3.5 h-3.5" />
                <span>Disconnect Call</span>
              </>
            ) : (
              <>
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call Sophia</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
