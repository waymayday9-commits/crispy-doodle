import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Users, Plus, Trash2, RotateCcw, Send, X, GripVertical } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useConfirmation } from '../../context/ConfirmationContext';

interface Tournament {
  id: string;
  name: string;
  status: 'upcoming' | 'active' | 'completed';
  tournament_date: string;
  location: string;
  beyblades_per_player: number;
  password?: string;
}

interface PlayerData {
  [playerName: string]: string[];
}

interface BeybladeInfo {
  name: string;
  blade_line: string;
}

interface PlayerBeybladeData {
  [playerName: string]: BeybladeInfo[];
}

interface Match {
  outcome: string | null;
  winner: string | null;
  points: number;
}

interface MatchMap {
  [index: number]: Match;
}

const pointMap = {
  "Over Finish (2 pts)": 2,
  "Burst Finish (2 pts)": 2,
  "Spin Finish (1 pt)": 1,
  "Extreme Finish (3 pts)": 3
};

const MatchTracker = () => {
  const { confirm, alert } = useConfirmation();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [tournamentPassword, setTournamentPassword] = useState('');
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [playerData, setPlayerData] = useState<PlayerData>({});
  const [playerBeybladeData, setPlayerBeybladeData] = useState<PlayerBeybladeData>({});
  const [loading, setLoading] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  
  // Match tracker state
  const [player1, setPlayer1] = useState('');
  const [player2, setPlayer2] = useState('');
  const [round, setRound] = useState(1);
  const [tournamentOfficer, setTournamentOfficer] = useState('');
  const [matchMap, setMatchMap] = useState<MatchMap>({});
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [phaseCounter, setPhaseCounter] = useState(2);
  const [pendingPhase, setPendingPhase] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');

  // Phase deck orders
  const [deckOrders, setDeckOrders] = useState<{[phase: number]: {[player: string]: string[]}}>({});
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  // Fetch tournaments on component mount
  useEffect(() => {
    fetchTournaments();
  }, []);

  // Fetch player data when tournament is selected
  useEffect(() => {
    if (selectedTournament) {
      setIsPasswordVerified(false);
      setTournamentPassword('');
      setPasswordError('');
      // Check if tournament has password
      const tournament = tournaments.find(t => t.id === selectedTournament);
      if (!tournament?.password) {
        // No password required, proceed directly
        setIsPasswordVerified(true);
        fetchPlayerData(selectedTournament);
      }
    }
  }, [selectedTournament]);

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('id, name, status, tournament_date, location, beyblades_per_player, password')
        .order('tournament_date', { ascending: false });

      if (error) throw error;
      setTournaments(data || []);
      
      // Auto-select first active tournament
      const activeTournament = data?.find(t => t.status === 'active');
      if (activeTournament) {
        setSelectedTournament(activeTournament.id);
      }
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const verifyPassword = () => {
    const tournament = tournaments.find(t => t.id === selectedTournament);
    if (!tournament?.password) {
      setIsPasswordVerified(true);
      fetchPlayerData(selectedTournament);
      return;
    }

    if (tournamentPassword === tournament.password) {
      setIsPasswordVerified(true);
      setPasswordError('');
      fetchPlayerData(selectedTournament);
    } else {
      setPasswordError('Incorrect password. Please try again.');
    }
  };

  const fetchPlayerData = async (tournamentId: string) => {
    setLoadingPlayers(true);
    try {
      const { data, error } = await supabase
        .from('tournament_registrations')
        .select(`
          player_name,
          tournament_beyblades(
            beyblade_name,
            blade_line
          )
        `)
        .eq('tournament_id', tournamentId)
        .eq('status', 'confirmed')
        .order('player_name', { ascending: true });

      if (error) throw error;

      const playerDataMap: PlayerData = {};
      const playerBeybladeDataMap: PlayerBeybladeData = {};
      data?.forEach(registration => {
        const playerName = registration.player_name;
        const beyblades = registration.tournament_beyblades.map((b: any) => b.beyblade_name);
        const beybladeInfo = registration.tournament_beyblades.map((b: any) => ({
          name: b.beyblade_name,
          blade_line: b.blade_line
        }));
        if (beyblades.length > 0) {
          playerDataMap[playerName] = beyblades;
          playerBeybladeDataMap[playerName] = beybladeInfo;
        }
      });

      setPlayerData(playerDataMap);
      setPlayerBeybladeData(playerBeybladeDataMap);
      
      resetMatchTracker();
    } catch (error) {
      console.error('Error fetching player data:', error);
      setPlayerData({});
    } finally {
      setLoadingPlayers(false);
    }
  };

  const resetMatchTracker = () => {
    setPlayer1('');
    setPlayer2('');
    setRound(1);
    setTournamentOfficer('');
    setMatchMap({});
    setP1Score(0);
    setP2Score(0);
    setPhaseCounter(2);
    setPendingPhase(false);
    setDeckOrders({});
    setPlayerBeybladeData({});
    setSubmitStatus('');
  };

  const handlePlayerSelect = (playerNum: 1 | 2, selectedPlayer: string) => {
    if (playerNum === 1) {
      setPlayer1(selectedPlayer);
      if (selectedPlayer === player2) {
        setPlayer2('');
      }
    } else {
      setPlayer2(selectedPlayer);
      if (selectedPlayer === player1) {
        setPlayer1('');
      }
    }

    // Reset scores and matches when players change
    if (selectedPlayer) {
      setMatchMap({});
      setP1Score(0);
      setP2Score(0);
      setPhaseCounter(2);
      setPendingPhase(false);
      setDeckOrders({});
    }
  };

  const getBey = (player: string, matchIndex: number): string => {
    const beybladeCount = selectedTournamentData?.beyblades_per_player || 3;
    const phase = Math.floor(matchIndex / beybladeCount) + 1;
    const slot = matchIndex % beybladeCount;

    if (phase === 1) {
      return playerData[player]?.[slot] || '';
    }

    // For phases 2+, use deck order if available
    const phaseOrder = deckOrders[phase]?.[player];
    if (phaseOrder) {
      return phaseOrder[slot] || '';
    }

    // Fallback to original order
    return playerData[player]?.[slot] || '';
  };

  const getBeyBladeLine = (player: string, matchIndex: number): string => {
    const beybladeCount = selectedTournamentData?.beyblades_per_player || 3;
    const phase = Math.floor(matchIndex / beybladeCount) + 1;
    const slot = matchIndex % beybladeCount;

    if (phase === 1) {
      return playerBeybladeData[player]?.[slot]?.blade_line || '';
    }

    // For phases 2+, find the blade line by matching the beyblade name
    const phaseOrder = deckOrders[phase]?.[player];
    if (phaseOrder) {
      const beybladeName = phaseOrder[slot];
      const beybladeInfo = playerBeybladeData[player]?.find(b => b.name === beybladeName);
      return beybladeInfo?.blade_line || '';
    }

    // Fallback to original order
    return playerBeybladeData[player]?.[slot]?.blade_line || '';
  };

  const addMatch = () => {
    if (pendingPhase) {
      alert('Phase Required', `Click Shuffle before adding the next match (after every ${selectedTournamentData?.beyblades_per_player || 3} matches).`);
      return;
    }

    if (!player1 || !player2) {
      alert('Missing Players', 'Please select both players first.');
      return;
    }

    let index = 0;
    while (matchMap[index] !== undefined) index++;
    
    const newMatchMap = {
      ...matchMap,
      [index]: { outcome: null, winner: null, points: 0 }
    };
    setMatchMap(newMatchMap);

    // Check if we need to enable shuffle based on tournament's beyblades_per_player
    const beybladeCount = selectedTournamentData?.beyblades_per_player || 3;
    const totalMatches = Object.keys(newMatchMap).length;
    if (totalMatches > 0 && (totalMatches % beybladeCount) === 0) {
      setPendingPhase(true);
    }
  };

  const setOutcome = (index: number, outcome: string) => {
    const newMatchMap = { ...matchMap };
    if (newMatchMap[index]) {
      // Update outcome
      newMatchMap[index].outcome = outcome;
      
      // Calculate points based on current selections
      const points = (outcome && newMatchMap[index].winner) ? 
        (pointMap[outcome as keyof typeof pointMap] || 0) : 0;
      newMatchMap[index].points = points;
    }
    setMatchMap(newMatchMap);
    
    // Recalculate total scores from scratch
    recalculateScores(newMatchMap);
  };

  const setWinner = (index: number, winner: string) => {
    const newMatchMap = { ...matchMap };
    if (newMatchMap[index]) {
      // Update winner
      newMatchMap[index].winner = winner;
      
      // Calculate points based on current selections
      const points = (newMatchMap[index].outcome && winner) ? 
        (pointMap[newMatchMap[index].outcome as keyof typeof pointMap] || 0) : 0;
      newMatchMap[index].points = points;
    }
    setMatchMap(newMatchMap);
    
    // Recalculate total scores from scratch
    recalculateScores(newMatchMap);
  };

  const recalculateScores = (matches: MatchMap) => {
    let p1Total = 0;
    let p2Total = 0;
    
    Object.values(matches).forEach(match => {
      if (match.winner && match.outcome && match.points > 0) {
        if (match.winner === player1) {
          p1Total += match.points;
        } else if (match.winner === player2) {
          p2Total += match.points;
        }
      }
    });
    
    setP1Score(p1Total);
    setP2Score(p2Total);
  };

  const removeMatch = (index: number) => {
    const newMatchMap = { ...matchMap };
    delete newMatchMap[index];
    setMatchMap(newMatchMap);
    recalculateScores(newMatchMap);
    setPendingPhase(false);
  };

  const shufflePhase = () => {
    const phase = phaseCounter;
    
    // Initialize deck orders for this phase with original order
    const newDeckOrders = { ...deckOrders };
    if (!newDeckOrders[phase]) {
      newDeckOrders[phase] = {
        [player1]: [...(playerData[player1] || [])],
        [player2]: [...(playerData[player2] || [])]
      };
    }
    setDeckOrders(newDeckOrders);
    
    setPhaseCounter(prev => prev + 1);
    setPendingPhase(false);
  };

  const updateDeckOrder = (phase: number, player: string, newOrder: string[]) => {
    setDeckOrders(prev => ({
      ...prev,
      [phase]: {
        ...prev[phase],
        [player]: newOrder
      }
    }));
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, beyblade: string) => {
    setDraggedItem(beyblade);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, phase: number, player: string, targetIndex: number) => {
    e.preventDefault();
    
    if (!draggedItem) return;
    
    const currentOrder = deckOrders[phase]?.[player] || [];
    const draggedIndex = currentOrder.indexOf(draggedItem);
    
    if (draggedIndex === -1) return;
    
    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);
    
    updateDeckOrder(phase, player, newOrder);
    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const submitMatches = async () => {
    if (!tournamentOfficer.trim()) {
      alert("Please enter the Tournament Officer name before submitting.");
      return;
    }

    const completeMatches = Object.entries(matchMap).filter(([_, match]) => 
      match.outcome && match.winner
    );

    if (completeMatches.length === 0) {
      alert("No complete matches to submit.");
      return;
    }

    setSubmitting(true);
    setSubmitStatus('Submitting matches...');

    try {
      // Prepare match results data
      const matchResults = completeMatches.map(([index, match]) => {
        const matchIndex = parseInt(index);
        return {
          tournament_id: selectedTournament,
          round_number: round,
          player1_name: player1,
          player2_name: player2,
          player1_beyblade: getBey(player1, matchIndex),
          player2_beyblade: getBey(player2, matchIndex),
          player1_blade_line: getBeyBladeLine(player1, matchIndex),
          player2_blade_line: getBeyBladeLine(player2, matchIndex),
          outcome: match.outcome,
          winner_name: match.winner,
          points_awarded: match.points,
          match_number: matchIndex + 1,
          phase_number: Math.floor(matchIndex / 3) + 1,
          tournament_officer: tournamentOfficer
        };
      });

      // Insert match results
      const { error: matchError } = await supabase
        .from('match_results')
        .insert(matchResults);

      if (matchError) throw matchError;

      // Insert session summary
      const { error: sessionError } = await supabase
        .from('match_sessions')
        .insert({
          tournament_id: selectedTournament,
          round_number: round,
          player1_name: player1,
          player2_name: player2,
          player1_final_score: p1Score,
          player2_final_score: p2Score,
          winner_name: p1Score > p2Score ? player1 : player2,
          total_matches: completeMatches.length,
          tournament_officer: tournamentOfficer,
          match_summary: completeMatches.map(([index, match]) => {
            const matchIndex = parseInt(index);
            const beyUsed = getBey(match.winner!, matchIndex);
            const beybladeCount = selectedTournamentData?.beyblades_per_player || 3;
            const phaseNumber = Math.floor(matchIndex / beybladeCount) + 1;
            const matchInPhase = (matchIndex % beybladeCount) + 1;
            return `Phase ${phaseNumber}, Match ${matchInPhase}: ${match.outcome} by ${match.winner} using ${beyUsed}`;
          }).join('; '),
          phases: Object.keys(deckOrders).length + 1,
          deck_orders: deckOrders
        });

      if (sessionError) throw sessionError;

      setSubmitStatus('✅ Matches submitted successfully!');
      setShowSummaryModal(false);
      
      // Reset form after successful submission
      setTimeout(() => {
        resetMatchTracker();
        setSubmitStatus('');
      }, 2000);

    } catch (error) {
      console.error('Error submitting matches:', error);
      setSubmitStatus('❌ Failed to submit matches. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const generateSummary = () => {
    const completeMatches = Object.entries(matchMap).filter(([_, match]) => 
      match.outcome && match.winner
    );

    return completeMatches.map(([index, match]) => {
      const matchIndex = parseInt(index);
      const beyUsed = getBey(match.winner!, matchIndex);
      return `Match ${matchIndex + 1}: ${match.outcome} by ${match.winner} using ${beyUsed}`;
    });
  };

  const selectedTournamentData = tournaments.find(t => t.id === selectedTournament);
  const playerNames = Object.keys(playerData);
  const availableP1Players = playerNames.filter(name => name !== player2);
  const availableP2Players = playerNames.filter(name => name !== player1);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tournaments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">OBC Match Tracker</h1>
        <p className="text-gray-600">Track tournament matches in real-time</p>
      </div>

      {/* Tournament Selection */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Tournament Selection</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Tournament
            </label>
            <select
              value={selectedTournament}
              onChange={(e) => setSelectedTournament(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select Tournament --</option>
              {tournaments.map(tournament => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.name} ({tournament.status})
                </option>
              ))}
            </select>
          </div>
          {selectedTournamentData && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900">{selectedTournamentData.name}</h3>
              <p className="text-sm text-gray-600">Status: <span className={`capitalize ${
                selectedTournamentData.status === 'active' ? 'text-green-600' :
                selectedTournamentData.status === 'upcoming' ? 'text-blue-600' : 'text-gray-600'
              }`}>{selectedTournamentData.status}</span></p>
              <p className="text-sm text-gray-600">Date: {new Date(selectedTournamentData.tournament_date).toLocaleDateString()}</p>
              <p className="text-sm text-gray-600">Location: {selectedTournamentData.location}</p>
              {selectedTournamentData.password && (
                <p className="text-sm text-orange-600 font-medium">🔒 Password protected</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Password Verification */}
      {selectedTournament && selectedTournamentData?.password && !isPasswordVerified && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            🔒 Tournament Access
          </h2>
          <p className="text-gray-600 mb-4">
            This tournament requires a password to access match tracking features.
          </p>
          <div className="max-w-md">
            <div className="flex space-x-3">
              <input
                type="password"
                placeholder="Enter tournament password"
                value={tournamentPassword}
                onChange={(e) => {
                  setTournamentPassword(e.target.value);
                  setPasswordError('');
                }}
                onKeyPress={(e) => e.key === 'Enter' && verifyPassword()}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={verifyPassword}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Verify
              </button>
            </div>
            {passwordError && (
              <p className="text-red-600 text-sm mt-2">{passwordError}</p>
            )}
          </div>
        </div>
      )}

      {selectedTournament && isPasswordVerified && (
        <>
          {/* Match Setup */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Match Setup</h2>
            {loadingPlayers ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading player data...</p>
              </div>
            ) : Object.keys(playerData).length === 0 ? (
              <div className="text-center py-8">
                <Users size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No confirmed registrations found for this tournament</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Round #
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={round}
                    onChange={(e) => setRound(parseInt(e.target.value) || 1)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Player 1
                  </label>
                  <select
                    value={player1}
                    onChange={(e) => handlePlayerSelect(1, e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select Player 1 --</option>
                    {availableP1Players.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Player 2
                  </label>
                  <select
                    value={player2}
                    onChange={(e) => handlePlayerSelect(2, e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Select Player 2 --</option>
                    {availableP2Players.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {player1 && player2 && (
            <>
              {/* Sticky/Hovering Score Bar */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-md p-4 mb-6">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                  <div>
                    <input
                      type="text"
                      placeholder="Tournament Officer"
                      value={tournamentOfficer}
                      onChange={(e) => setTournamentOfficer(e.target.value)}
                      className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>
                  <div className="text-lg font-bold">
                    <span className={`${p1Score > p2Score ? 'text-green-600' : p1Score < p2Score ? 'text-red-600' : 'text-gray-600'}`}>
                      {player1}: {p1Score}
                    </span>
                    <span className="mx-4 text-gray-400">|</span>
                    <span className={`${p2Score > p1Score ? 'text-green-600' : p2Score < p1Score ? 'text-red-600' : 'text-gray-600'}`}>
                      {player2}: {p2Score}
                    </span>
                  </div>
                </div>
              </div>

              {/* Phase 1 Decks */}
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Phase 1 Decks ({selectedTournamentData?.beyblades_per_player || 3} Beyblades)
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2"></th>
                        <th className="text-left py-2 font-semibold">{player1}</th>
                        <th className="text-left py-2 font-semibold">{player2}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: selectedTournamentData?.beyblades_per_player || 3 }, (_, i) => (
                        <tr key={i} className="border-b">
                          <td className="py-2 font-medium">Bey {i + 1}</td>
                          <td className="py-2">{playerData[player1]?.[i] || ''}</td>
                          <td className="py-2">{playerData[player2]?.[i] || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Matches */}
              <div className="space-y-4 mb-6">
                {Object.entries(matchMap).map(([index, match]) => {
                  const matchIndex = parseInt(index);
                  const bey1 = getBey(player1, matchIndex);
                  const bey2 = getBey(player2, matchIndex);
                  const matchNumber = matchIndex + 1;
                  const beybladeCount = selectedTournamentData?.beyblades_per_player || 3;
                  const shouldShowPhaseCard = matchNumber % beybladeCount === 0 && matchNumber > 0;
                  const phaseNumber = Math.floor(matchNumber / beybladeCount) + 1;
                  
                  return (
                    <div key={index}>
                      <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex justify-between items-start mb-4">
                          <h3 className="text-lg font-bold">
                            Match {matchNumber}: {bey1} vs {bey2}
                          </h3>
                          <button
                            onClick={() => removeMatch(matchIndex)}
                            className="text-red-600 hover:bg-red-50 p-1 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-semibold mb-2">Outcome:</h4>
                            <div className="space-y-2">
                              {Object.keys(pointMap).map(outcome => (
                                <button
                                  key={outcome}
                                  onClick={() => setOutcome(matchIndex, outcome)}
                                  className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                                    match.outcome === outcome
                                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                  }`}
                                >
                                  {outcome}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 className="font-semibold mb-2">Winner:</h4>
                            <div className="space-y-2">
                              <button
                                onClick={() => setWinner(matchIndex, player1)}
                                className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                                  match.winner === player1
                                    ? 'bg-green-100 border-green-300 text-green-700'
                                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                {player1}
                              </button>
                              <button
                                onClick={() => setWinner(matchIndex, player2)}
                                className={`w-full text-left px-3 py-2 rounded border transition-colors ${
                                  match.winner === player2
                                    ? 'bg-green-100 border-green-300 text-green-700'
                                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                {player2}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Phase Deck Card - Show after every 3rd match */}
                      {shouldShowPhaseCard && phaseNumber > 1 && deckOrders[phaseNumber] && (
                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow-md p-6 mt-4 border-2 border-purple-200">
                          <h3 className="text-lg font-bold text-purple-900 mb-4 flex items-center">
                            <RotateCcw className="mr-2" size={20} />
                            Phase {phaseNumber} Decks - Drag to Reorder
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h4 className="font-semibold mb-3 text-purple-800">{player1}</h4>
                              <div className="space-y-2">
                                {deckOrders[phaseNumber][player1]?.map((bey, index) => (
                                  <div
                                    key={`${phaseNumber}-${player1}-${index}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, bey)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, phaseNumber, player1, index)}
                                    onDragEnd={handleDragEnd}
                                    className={`bg-white p-3 rounded border-2 cursor-move transition-all duration-200 flex items-center ${
                                      draggedItem === bey 
                                        ? 'border-purple-400 shadow-lg opacity-50' 
                                        : 'border-gray-200 hover:border-purple-300 hover:shadow-md'
                                    }`}
                                  >
                                    <GripVertical size={16} className="text-gray-400 mr-2" />
                                    <span className="font-medium text-gray-700">{index + 1}.</span>
                                    <span className="ml-2">{bey}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h4 className="font-semibold mb-3 text-purple-800">{player2}</h4>
                              <div className="space-y-2">
                                {deckOrders[phaseNumber][player2]?.map((bey, index) => (
                                  <div
                                    key={`${phaseNumber}-${player2}-${index}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, bey)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, phaseNumber, player2, index)}
                                    onDragEnd={handleDragEnd}
                                    className={`bg-white p-3 rounded border-2 cursor-move transition-all duration-200 flex items-center ${
                                      draggedItem === bey 
                                        ? 'border-purple-400 shadow-lg opacity-50' 
                                        : 'border-gray-200 hover:border-purple-300 hover:shadow-md'
                                    }`}
                                  >
                                    <GripVertical size={16} className="text-gray-400 mr-2" />
                                    <span className="font-medium text-gray-700">{index + 1}.</span>
                                    <span className="ml-2">{bey}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-center space-x-4 mb-6">
                <button
                  onClick={pendingPhase ? shufflePhase : addMatch}
                  className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Plus size={20} />
                  <span>{pendingPhase ? 'Shuffle' : 'Add Match'}</span>
                </button>
                
                <button
                  onClick={() => setShowSummaryModal(true)}
                  disabled={Object.values(matchMap).every(match => !match.outcome || !match.winner)}
                  className="bg-green-600 text-white px-6 py-3 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  <Send size={20} />
                  <span>Submit Scores</span>
                </button>

                <button
                  onClick={resetMatchTracker}
                  className="bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700 transition-colors flex items-center space-x-2"
                >
                  <RotateCcw size={20} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Status */}
              {submitStatus && (
                <div className="text-center py-4">
                  <p className={`font-semibold ${
                    submitStatus.includes('✅') ? 'text-green-600' :
                    submitStatus.includes('❌') ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    {submitStatus}
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Match Summary</h2>
              <button
                onClick={() => setShowSummaryModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Final Scores</h3>
                <p className="text-xl">
                  <strong>{player1}:</strong> {p1Score} pts | <strong>{player2}:</strong> {p2Score} pts
                </p>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Match Results</h3>
                <div className="space-y-2">
                  {generateSummary().map((summary, index) => (
                    <p key={index} className="text-gray-700" dangerouslySetInnerHTML={{ __html: summary }} />
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowSummaryModal(false)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={submitMatches}
                  disabled={submitting}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {submitting && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                  <span>Confirm Submit</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchTracker;