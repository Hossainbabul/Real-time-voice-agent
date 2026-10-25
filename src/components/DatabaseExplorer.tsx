import React, { useState, useEffect } from 'react';
import { 
  Database, 
  RotateCcw, 
  Terminal, 
  Search, 
  Plus, 
  Check, 
  AlertCircle,
  Play
} from 'lucide-react';
import { TableRow, MenuItemRow, ReservationRow } from '../types';

interface DatabaseExplorerProps {
  onDatabaseChanged?: () => void;
}

export const DatabaseExplorer: React.FC<DatabaseExplorerProps> = ({ onDatabaseChanged }) => {
  const [activeTab, setActiveTab] = useState<'menu' | 'tables' | 'reservations' | 'terminal'>('menu');
  const [tables, setTables] = useState<TableRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [reservations, setReservations] = useState<ReservationRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  
  // Custom SQL Console state
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM menu_items WHERE allergen_status = \'UNVERIFIED\';');
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);

  const fetchDbState = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/db/state');
      if (res.ok) {
        const data = await res.json();
        setTables(data.tables || []);
        setMenuItems(data.menuItems || []);
        setReservations(data.reservations || []);
      }
    } catch (err) {
      console.error('Failed to fetch DB state:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDbState();
  }, []);

  const handleResetDb = async () => {
    if (!confirm('Reset SQLite database to default Trattoria Bella seed data?')) return;
    try {
      const res = await fetch('/api/db/reset', { method: 'POST' });
      if (res.ok) {
        await fetchDbState();
        if (onDatabaseChanged) onDatabaseChanged();
      }
    } catch (err) {
      console.error('Failed to reset DB:', err);
    }
  };

  const handleRunSql = async () => {
    setSqlError(null);
    setSqlResult(null);
    try {
      const res = await fetch('/api/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sqlQuery })
      });
      const data = await res.json();
      if (!res.ok) {
        setSqlError(data.error || 'SQL execution failed');
      } else {
        setSqlResult(data);
        await fetchDbState();
        if (onDatabaseChanged) onDatabaseChanged();
      }
    } catch (err: any) {
      setSqlError(err.message || 'Network error');
    }
  };

  const filteredMenuItems = menuItems.filter(item => 
    item.dish_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
    item.ingredients.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (item.verified_allergens && item.verified_allergens.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-800">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-500" />
            <h2 className="text-base font-semibold text-stone-100">
              SQLite Database & Schema Inspector
            </h2>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Local relational SQLite storage powering table reservations, time-slot scheduling, and verified kitchen allergen registries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleResetDb}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-md transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Seed State</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-stone-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('menu')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'menu'
                ? 'bg-stone-800 text-amber-400 border border-stone-700'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            menu_items ({menuItems.length})
          </button>
          <button
            onClick={() => setActiveTab('tables')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'tables'
                ? 'bg-stone-800 text-amber-400 border border-stone-700'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            tables ({tables.length})
          </button>
          <button
            onClick={() => setActiveTab('reservations')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'reservations'
                ? 'bg-stone-800 text-amber-400 border border-stone-700'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            reservations ({reservations.length})
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'terminal'
                ? 'bg-stone-800 text-amber-400 border border-stone-700'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Terminal className="w-3 h-3" />
            <span>SQL Console</span>
          </button>
        </div>

        {activeTab === 'menu' && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-stone-500" />
            <input
              type="text"
              placeholder="Search dishes or allergens..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="bg-stone-950 border border-stone-800 rounded-md pl-8 pr-3 py-1 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        )}
      </div>

      {/* Tab 1: Menu Items Table */}
      {activeTab === 'menu' && (
        <div className="space-y-3">
          <div className="text-[11px] text-stone-400 bg-stone-950/80 p-2.5 rounded-lg border border-stone-800/80 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              <strong>Architect's Note (Fail-Closed Safety):</strong> Items marked <span className="text-amber-400 font-mono">UNVERIFIED</span> (e.g. Truffle Mushroom Risotto, Chef's Special) test the guardrail. Sophia will strictly refuse to claim they are safe.
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-stone-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-950 text-stone-400 uppercase text-[10px] tracking-wider border-b border-stone-800">
                <tr>
                  <th className="py-2.5 px-4 font-mono">ID</th>
                  <th className="py-2.5 px-4">Dish Name</th>
                  <th className="py-2.5 px-4">Key Ingredients</th>
                  <th className="py-2.5 px-4">Verified Allergens</th>
                  <th className="py-2.5 px-4 text-right">Guardrail Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800 font-sans">
                {filteredMenuItems.map((item) => (
                  <tr key={item.item_id} className="hover:bg-stone-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-stone-500 tabular-nums">{item.item_id}</td>
                    <td className="py-3 px-4 font-medium text-stone-100">{item.dish_name}</td>
                    <td className="py-3 px-4 text-stone-400 max-w-xs truncate">{item.ingredients}</td>
                    <td className="py-3 px-4 font-mono text-stone-300">
                      {item.verified_allergens ? item.verified_allergens : <span className="text-stone-600 italic">NULL</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[11px]">
                      {item.allergen_status === 'VERIFIED' ? (
                        <span className="text-emerald-400 font-medium">VERIFIED</span>
                      ) : (
                        <span className="text-amber-400 font-medium">UNVERIFIED</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Tables Layout */}
      {activeTab === 'tables' && (
        <div className="space-y-3">
          <div className="text-[11px] text-stone-400 bg-stone-950/80 p-2.5 rounded-lg border border-stone-800/80">
            Trattoria Bella dining floor plan: Tables with 2, 4, 6, and 8-seat capacities. Availability calculation is executed via pure SQL comparison, never LLM hallucination.
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {tables.map((tbl) => (
              <div 
                key={tbl.table_id} 
                className="bg-stone-950 border border-stone-800 rounded-lg p-3 text-center space-y-1"
              >
                <div className="text-[10px] text-stone-500 uppercase tracking-wider font-mono">
                  Table {tbl.table_id}
                </div>
                <div className="text-xl font-semibold font-mono text-stone-100 tabular-nums">
                  {tbl.capacity}
                </div>
                <div className="text-[10px] text-stone-400">
                  Seats Capacity
                </div>
                <div className="pt-1 text-[10px] text-emerald-400 font-mono">
                  {tbl.is_active ? 'ACTIVE' : 'INACTIVE'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Reservations */}
      {activeTab === 'reservations' && (
        <div className="space-y-3">
          <div className="text-[11px] text-stone-400 bg-stone-950/80 p-2.5 rounded-lg border border-stone-800/80">
            Active reservations ledger. Pre-seeded with 19:30 conflict bookings to test alternative time slot negotiation (suggesting 20:00).
          </div>

          <div className="overflow-x-auto rounded-lg border border-stone-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-950 text-stone-400 uppercase text-[10px] tracking-wider border-b border-stone-800">
                <tr>
                  <th className="py-2.5 px-4 font-mono">Booking ID</th>
                  <th className="py-2.5 px-4">Guest Name</th>
                  <th className="py-2.5 px-4 font-mono">Party Size</th>
                  <th className="py-2.5 px-4 font-mono">Reservation Time</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800 font-sans">
                {reservations.map((res) => (
                  <tr key={res.reservation_id} className="hover:bg-stone-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono text-amber-300">RES-{res.reservation_id}</td>
                    <td className="py-3 px-4 font-medium text-stone-100">{res.customer_name}</td>
                    <td className="py-3 px-4 font-mono text-stone-300 tabular-nums">{res.party_size} Guests</td>
                    <td className="py-3 px-4 font-mono text-stone-300 tabular-nums">{res.reservation_time}</td>
                    <td className="py-3 px-4 text-right font-mono text-[11px] text-emerald-400">
                      {res.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Raw SQL Terminal */}
      {activeTab === 'terminal' && (
        <div className="space-y-4">
          <div className="text-xs text-stone-400">
            Direct SQL query runner on the local SQLite database. Test DQL (`SELECT`) or DML (`INSERT`, `UPDATE`).
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-stone-400">
              <span className="font-mono text-amber-400">SQL Query:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSqlQuery('SELECT * FROM menu_items WHERE allergen_status = \'UNVERIFIED\';')}
                  className="text-[10px] text-stone-400 hover:text-stone-200 underline cursor-pointer"
                >
                  Unverified items
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => setSqlQuery('SELECT * FROM reservations ORDER BY reservation_id DESC;')}
                  className="text-[10px] text-stone-400 hover:text-stone-200 underline cursor-pointer"
                >
                  All bookings
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 rounded-lg p-3 font-mono text-xs text-stone-200 focus:outline-none focus:border-amber-500"
            />

            <div className="flex justify-end">
              <button
                onClick={handleRunSql}
                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-md text-xs font-medium cursor-pointer transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Execute Query</span>
              </button>
            </div>
          </div>

          {sqlError && (
            <div className="p-3 bg-red-950/60 border border-red-800 rounded-lg text-xs text-red-300 font-mono">
              Error: {sqlError}
            </div>
          )}

          {sqlResult && (
            <div className="space-y-2">
              <div className="text-xs text-stone-400 font-mono">
                Query Result ({sqlResult.count !== undefined ? `${sqlResult.count} rows` : 'Executed'}):
              </div>
              <pre className="bg-stone-950 p-3 rounded-lg border border-stone-800 font-mono text-xs text-stone-200 max-h-60 overflow-y-auto">
                {JSON.stringify(sqlResult.rows || sqlResult.message, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
