import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useConfirmation } from '../../context/ConfirmationContext';
import { useAuth } from '../../context/AuthContext';
import { Users, Trash2, RefreshCw, X, GripVertical, Clipboard } from 'lucide-react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';

interface Registration {
  id: string;
  player_name: string;
  team?: string;
  team_with_player?: string;
  payment_mode: string;
  registered_at: string;
  status: string;
  payment_status: string;
  beyblades: Array<{
    beyblade_id: string;
    beyblade_name: string;
    blade_line: string;
    beyblade_index?: number;
  }>;
}

export function TournamentRegistrationsPage({
  tournamentId,
  onBack,
}: {
  tournamentId: string;
  onBack: () => void;
}) {
  const { alert, confirm } = useConfirmation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'developer';

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal state
  const [editModal, setEditModal] = useState<Registration | null>(null);
  const [editOrder, setEditOrder] = useState<any[]>([]);
  const [savingOrder, setSavingOrder] = useState(false);

  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tournament_registrations')
        .select(`
          id,
          player_name,
          team,
          team_with_player,
          payment_mode,
          registered_at,
          status,
          payment_status,
          tournament_beyblades (
            id,
            beyblade_name,
            blade_line,
            beyblade_index
          )
        `)
        .eq('tournament_id', tournamentId)
        .order('registered_at', { ascending: false });

      if (error) throw error;

      const registrations: Registration[] = (data || []).map((row: any) => ({
        id: row.id,
        player_name: row.player_name,
        team: row.team,
        team_with_player: row.team_with_player,
        payment_mode: row.payment_mode,
        registered_at: row.registered_at,
        status: row.status,
        payment_status: row.payment_status || 'confirmed',
        beyblades: (row.tournament_beyblades || []).map((b: any) => ({
          beyblade_id: b.id,
          beyblade_name: b.beyblade_name,
          blade_line: b.blade_line,
          beyblade_index: b.beyblade_index,
        })),
      }));

      const sorted = registrations.map((r) => ({
        ...r,
        beyblades: r.beyblades.sort(
          (a, b) => (a.beyblade_index || 9999) - (b.beyblade_index || 9999)
        ),
      }));

      setRegistrations(sorted);
    } catch (err) {
      console.error('Error fetching registrations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId]);

  const confirmPayment = async (id: string) => {
    const ok = await confirm('Confirm Payment', 'Mark this registration as paid?');
    if (!ok) return;
    try {
      const { error } = await supabase
        .from('tournament_registrations')
        .update({ status: 'confirmed', payment_status: 'paid' })
        .eq('id', id);
      if (error) throw error;
      fetchRegistrations();
      alert('Success', 'Payment confirmed');
    } catch (err) {
      console.error(err);
      alert('Error', 'Failed to confirm payment');
    }
  };

  const deleteRegistration = async (id: string) => {
    const ok = await confirm(
      'Delete Registration',
      'Are you sure? This cannot be undone.'
    );
    if (!ok) return;
    try {
      const { error } = await supabase
        .from('tournament_registrations')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchRegistrations();
      alert('Deleted', 'Registration removed');
    } catch (err) {
      console.error(err);
      alert('Error', 'Failed to delete registration');
    }
  };

  const saveBeybladeOrder = async () => {
    if (!editModal) return;
    setSavingOrder(true);
    try {
      // assign new indexes based on current drag order
      const updates = editOrder.map((b, index) => ({
        id: b.beyblade_id,
        beyblade_index: index + 1, // always start from 1
      }));

      for (const u of updates) {
        const { error } = await supabase
          .from('tournament_beyblades')
          .update({ beyblade_index: u.beyblade_index })
          .eq('id', u.id);

        if (error) throw error;
      }

      alert('Updated', 'Beyblade order updated');
      setEditModal(null);
      setEditOrder([]);
      await fetchRegistrations();
    } catch (err) {
      console.error(err);
      alert('Error', 'Failed to update Beyblade order');
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const reordered = Array.from(editOrder);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    setEditOrder(reordered);
  };

  const filtered = registrations.filter(
    (r) =>
      r.player_name.toLowerCase().includes(search.toLowerCase()) ||
      r.beyblades.some((b) =>
        b.beyblade_name.toLowerCase().includes(search.toLowerCase())
      )
  );

  const handleCopyPlayers = () => {
    // Copy oldest first (so reverse the DESC order)
    const sortedByOldest = [...filtered].sort(
      (a, b) => new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime()
    );
    const text = sortedByOldest
      .map((r, i) => `${i + 1}. ${r.player_name}`)
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied', 'Player list copied to clipboard');
    });
  };

  return (
    <div className="bg-slate-950 text-white p-4 rounded-none">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 transition"
          >
            ← Back
          </button>
          <button
            onClick={fetchRegistrations}
            disabled={loading}
            className="px-4 py-2 bg-cyan-600 text-white rounded-none hover:bg-cyan-700 disabled:opacity-50 transition-colors flex items-center space-x-2"
          >
            <RefreshCw
              size={16}
              className={loading ? 'animate-spin' : ''}
            />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleCopyPlayers}
            className="px-4 py-2 bg-green-600 text-white rounded-none hover:bg-green-700 flex items-center space-x-2"
          >
            <Clipboard size={16} />
            <span>Copy All Players</span>
          </button>
        </div>
        <input
          type="text"
          placeholder="Search players or Beyblades..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-slate-900 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
        />
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-12">
          Loading registrations...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Users size={48} className="mx-auto text-slate-600 mb-4" />
          No registrations found
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-900 text-slate-300 text-left">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Payment</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Beyblades</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => {
                // Oldest is #1
                const number = filtered.length - idx;
                const displayName = r.team_with_player || r.player_name;
                return (
                  <tr
                    key={r.id}
                    className="border-b border-slate-800 hover:bg-slate-800/30 transition"
                  >
                    <td className="px-3 py-2 text-slate-400">{number}</td>
                    <td className="px-3 py-2 font-medium">
                      {r.team ? (
                        <div>
                          <div className="text-white">{displayName}</div>
                          <div className="text-xs text-slate-400">Team: {r.team}</div>
                        </div>
                      ) : (
                        displayName
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-400">
                      {new Date(r.registered_at).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">{r.payment_mode || 'N/A'}</td>
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2">
                      {r.beyblades.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {r.beyblades
                            .sort(
                              (a, b) =>
                                (a.beyblade_index || 999) -
                                (b.beyblade_index || 999)
                            )
                            .map((b) => (
                              <span
                                key={b.beyblade_id}
                                className="border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-200"
                              >
                                {b.beyblade_index || '?'}. {b.beyblade_name}
                              </span>
                            ))}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 italic">
                          No Beyblades
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        {r.status === 'pending' && (
                          <button
                            onClick={() => confirmPayment(r.id)}
                            className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded hover:bg-green-500/30"
                          >
                            Confirm
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setEditModal(r);
                              setEditOrder(r.beyblades);
                            }}
                            className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded hover:bg-blue-500/30"
                          >
                            Edit Order
                          </button>
                        )}
                        <button
                          onClick={() => deleteRegistration(r.id)}
                          className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded hover:bg-red-500/30"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Order Modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">
                Edit Beyblade Order - {editModal.player_name}
              </h3>
              <button
                onClick={() => setEditModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="beyblades">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2"
                  >
                    {editOrder.map((b, index) => (
                      <Draggable
                        key={b.beyblade_id}
                        draggableId={b.beyblade_id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center justify-between px-3 py-2 rounded bg-slate-800 border border-slate-700 ${
                              snapshot.isDragging ? 'bg-slate-700' : ''
                            }`}
                          >
                            <span className="text-slate-200">
                              {index + 1}. {b.beyblade_name}
                            </span>
                            <span
                              {...provided.dragHandleProps}
                              className="text-slate-400 cursor-grab hover:text-white"
                            >
                              <GripVertical size={18} />
                            </span>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setEditModal(null)}
                className="px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={saveBeybladeOrder}
                disabled={savingOrder}
                className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-500 disabled:opacity-50 flex items-center space-x-2"
              >
                {savingOrder && (
                  <RefreshCw size={16} className="animate-spin" />
                )}
                <span>Save Order</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}