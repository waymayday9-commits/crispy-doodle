import React, { useState, useEffect } from 'react';
import { X, User, UserCheck, Layers, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useConfirmation } from '../../context/ConfirmationContext';
import { StatBar } from './StatBar';
import { supabase } from '../../lib/supabase';

interface TournamentRegistrationProps {
  tournament: any;
  onClose: () => void;
  onRegistered?: () => void;
}

interface BeybladeSlot {
  id: string;
  parts: { [key: string]: any };
  isCustomLine: boolean;
}

interface Deck {
  id: string;
  name: string;
  beyblades: BeybladeSlot[];
}

export function TournamentRegistration({ tournament, onClose, onRegistered }: TournamentRegistrationProps) {
  const { user } = useAuth();
  const { alert } = useConfirmation();

  const [playerName, setPlayerName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [paymentMode, setPaymentMode] = useState<'free' | 'cash' | 'gcash' | 'bank_transfer'>(
    tournament.is_free ? 'free' : 'cash'
  );
  
  // Deck system
  const [currentDeckIndex, setCurrentDeckIndex] = useState(0);
  const [decks, setDecks] = useState<Deck[]>([]);
  
  const [deckPresets, setDeckPresets] = useState<any[]>([]);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [registeringForSelf, setRegisteringForSelf] = useState(false);
  const [partsData, setPartsData] = useState({
    blades: [],
    ratchets: [],
    bits: [],
    lockchips: [],
    assistBlades: []
  });
  const [isLoadingParts, setIsLoadingParts] = useState(false);
  const [partsError, setPartsError] = useState<string | null>(null);
  const [existingPlayerNames, setExistingPlayerNames] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // UI state
  const [expandedStats, setExpandedStats] = useState<{ [key: string]: boolean }>({});
  const [showReviewModal, setShowReviewModal] = useState(false);

  useEffect(() => {
    const beybladeCount = tournament.beyblades_per_player || 3;
    const initialDeck: Deck = {
      id: `deck0`,
      name: playerName || "Main Deck",
      beyblades: Array.from({ length: beybladeCount }, (_, beyIndex) => ({
        id: `deck0_bey${beyIndex}`,
        parts: {},
        isCustomLine: false,
      })),
    };
    setDecks([initialDeck]);
  }, [tournament.beyblades_per_player]);
  
  // Add Deck
  const addDeck = () => {
    if (decks.length >= (tournament.decks_per_player || 1)) return;
    const beybladeCount = tournament.beyblades_per_player || 3;
    const newDeckIndex = decks.length;
    const newDeck: Deck = {
      id: `deck${newDeckIndex}`,
      name: `${playerName || "Player"} ${newDeckIndex + 1}`,
      beyblades: Array.from({ length: beybladeCount }, (_, beyIndex) => ({
        id: `deck${newDeckIndex}_bey${beyIndex}`,
        parts: {},
        isCustomLine: false,
      })),
    };
    setDecks([...decks, newDeck]);
    setCurrentDeckIndex(newDeckIndex);
  };
  
  // Remove Deck
  const removeDeck = (deckIndex: number) => {
    if (decks.length <= 1) return; // must keep at least one deck
    const updated = decks.filter((_, i) => i !== deckIndex);
    setDecks(updated);
    setCurrentDeckIndex(Math.max(0, deckIndex - 1));
  };


  // Update deck names when player name changes
  useEffect(() => {
    if (playerName.trim()) {
      const displayName = tournament.tournament_settings?.match_format === 'teams' && teamName.trim()
        ? `${teamName.trim()} ${playerName.trim()}`
        : playerName.trim();
        
      setDecks(prevDecks => 
        prevDecks.map((deck, index) => ({
          ...deck,
          name: index === 0 ? displayName : `${displayName} ${index + 1}`
        }))
      );
    }
  }, [playerName, teamName, tournament.tournament_settings?.match_format]);

  // Auto-fill player name when registering for self
  useEffect(() => {
    if (registeringForSelf && user && !user.id.startsWith('guest-')) {
      setPlayerName(user.username);
    } else if (!registeringForSelf) {
      setPlayerName('');
    }
  }, [registeringForSelf, user]);

  useEffect(() => {
    fetchPartsData();
    fetchDeckPresets();
    fetchExistingPlayerNames();
  }, []);

  const fetchPartsData = async () => {
    setIsLoadingParts(true);
    setPartsError(null);

    try {
      const [bladesRes, ratchetsRes, bitsRes, lockchipsRes, assistBladesRes] = await Promise.all([
        supabase.from('beypart_blade').select('*'),
        supabase.from('beypart_ratchet').select('*'),
        supabase.from('beypart_bit').select('*'),
        supabase.from('beypart_lockchip').select('*'),
        supabase.from('beypart_assistblade').select('*')
      ]);

      if (bladesRes.error) throw bladesRes.error;
      if (ratchetsRes.error) throw ratchetsRes.error;
      if (bitsRes.error) throw bitsRes.error;
      if (lockchipsRes.error) throw lockchipsRes.error;
      if (assistBladesRes.error) throw assistBladesRes.error;

      setPartsData({
        blades: bladesRes.data || [],
        ratchets: ratchetsRes.data || [],
        bits: bitsRes.data || [],
        lockchips: lockchipsRes.data || [],
        assistBlades: assistBladesRes.data || []
      });
    } catch (err) {
      console.error(err);
      setPartsError('Failed to load Beyblade parts. Please try again.');
    } finally {
      setIsLoadingParts(false);
    }
  };

  const fetchDeckPresets = async () => {
    if (!user || user.id.startsWith('guest-')) return;
    try {
      const { data, error } = await supabase
        .from('deck_presets')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setDeckPresets(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchExistingPlayerNames = async () => {
    try {
      const { data, error } = await supabase
        .from('tournament_registrations')
        .select('player_name')
        .eq('tournament_id', tournament.id)
        .in('status', ['pending', 'confirmed']);
      if (error) throw error;
      setExistingPlayerNames((data || []).map((r: any) => r.player_name.toLowerCase().trim()));
    } catch (err) {
      console.error('Error fetching player names', err);
    }
  };

  const getRequiredParts = (bladeLine: string): string[] => {
    return bladeLine === 'Custom'
      ? ['Lockchip', 'Main Blade', 'Assist Blade', 'Ratchet', 'Bit']
      : ['Blade', 'Ratchet', 'Bit'];
  };

  const getPartOptions = (partType: string) => {
    let options: any[] = [];
    switch (partType) {
      case 'Blade':
        options = partsData.blades.filter(blade => blade.Line !== 'Custom');
        break;
      case 'Main Blade':
        options = partsData.blades.filter(blade => blade.Line === 'Custom');
        break;
      case 'Ratchet':
        options = partsData.ratchets;
        break;
      case 'Bit':
        options = partsData.bits;
        break;
      case 'Lockchip':
        options = partsData.lockchips;
        break;
      case 'Assist Blade':
        options = partsData.assistBlades;
        break;
    }
    return options.sort((a, b) => getPartDisplayName(a, partType).localeCompare(getPartDisplayName(b, partType)));
  };

  const getPartDisplayName = (part: any, partType: string) => {
    switch (partType) {
      case 'Blade':
      case 'Main Blade':
        return part?.Blades ?? '';
      case 'Ratchet':
        return part?.Ratchet ?? '';
      case 'Bit':
        return `${part?.Bit ?? ''}${part?.Shortcut ? ` (${part.Shortcut})` : ''}`;
      case 'Lockchip':
        return part?.Lockchip ?? '';
      case 'Assist Blade':
        return `${part?.['Assist Blade Name'] ?? ''}${part?.['Assist Blade'] ? ` (${part['Assist Blade']})` : ''}`;
      default:
        return '';
    }
  };

  const generateBeybladeName = (beyblade: BeybladeSlot) => {
    const requiredParts = getRequiredParts(beyblade.isCustomLine ? 'Custom' : 'Basic');
    if (!requiredParts.every(p => beyblade.parts[p])) return '';
    
    if (beyblade.isCustomLine) {
      const { Lockchip, 'Main Blade': MainBlade, 'Assist Blade': AssistBlade, Ratchet, Bit } = beyblade.parts;
      return `${Lockchip?.Lockchip || ''}${MainBlade?.Blades || ''} ${AssistBlade?.['Assist Blade'] || ''}${Ratchet?.Ratchet || ''}${Bit?.Shortcut || ''}`;
    } else {
      const { Blade, Ratchet, Bit } = beyblade.parts;
      return `${Blade?.Blades || ''} ${Ratchet?.Ratchet || ''}${Bit?.Shortcut || ''}`;
    }
  };

  const calculateStats = (parts: any) => {
    return Object.values(parts).reduce(
      (stats: any, part: any) => {
        if (part) {
          stats.attack += part.Attack || 0;
          stats.defense += part.Defense || 0;
          stats.stamina += part.Stamina || 0;
          stats.dash += part.Dash || 0;
          stats.burstRes += part['Burst Res'] || 0;
        }
        return stats;
      },
      { attack: 0, defense: 0, stamina: 0, dash: 0, burstRes: 0 }
    );
  };

  const updateBeyblade = (deckIndex: number, beybladeIndex: number, field: string, value: any) => {
    setDecks(prevDecks => 
      prevDecks.map((deck, dIndex) => {
        if (dIndex === deckIndex) {
          return {
            ...deck,
            beyblades: deck.beyblades.map((bey, bIndex) => {
              if (bIndex === beybladeIndex) {
                if (field === 'isCustomLine') {
                  return { ...bey, [field]: value, parts: {} };
                }
                return { ...bey, [field]: value };
              }
              return bey;
            })
          };
        }
        return deck;
      })
    );
  };

  const updatePart = (deckIndex: number, beybladeIndex: number, partType: string, selectedPart: any) => {
    setDecks(prevDecks => 
      prevDecks.map((deck, dIndex) => {
        if (dIndex === deckIndex) {
          return {
            ...deck,
            beyblades: deck.beyblades.map((bey, bIndex) => {
              if (bIndex === beybladeIndex) {
                const newParts = { ...bey.parts, [partType]: selectedPart };
  
                // Auto-set blade line if this is a blade/main blade
                if (partType === "Blade" || partType === "Main Blade") {
                  newParts._Line = selectedPart?.Line || (bey.isCustomLine ? "Custom" : "Basic");
                }
  
                return { ...bey, parts: newParts };
              }
              return bey;
            })
          };
        }
        return deck;
      })
    );
  };

  const loadPreset = (presetId: string) => {
    const preset = deckPresets.find(p => p.id === presetId);
    if (!preset) return;
    
    const firstBey = preset.beyblades[0];
    const hasCustomParts = firstBey && (firstBey.parts.Lockchip || firstBey.parts['Main Blade'] || firstBey.parts['Assist Blade']);
    
    const currentDeck = decks[currentDeckIndex];
    if (!currentDeck) return;

    const updatedBeyblades = currentDeck.beyblades.map((slot, index) => {
      const presetBey = preset.beyblades[index];
      if (presetBey) {
        return {
          ...slot,
          isCustomLine: hasCustomParts,
          parts: presetBey.parts
        };
      }
      return slot;
    });

    setDecks(prevDecks => 
      prevDecks.map((deck, index) => 
        index === currentDeckIndex 
          ? { ...deck, beyblades: updatedBeyblades }
          : deck
      )
    );
    setSelectedPreset('');
  };

  const toggleStats = (deckIndex: number, beybladeIndex: number) => {
    const key = `${deckIndex}_${beybladeIndex}`;
    setExpandedStats(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getPartKey = (part: any, partType: string) => {
    const name = getPartDisplayName(part, partType);
    if (name) return `${partType}:::${name}`;
    try {
      return `${partType}:::${JSON.stringify(part)}`;
    } catch {
      return `${partType}:::unknown`;
    }
  };

  const isPartUsedElsewhere = (currentDeckIndex: number, currentBeyIndex: number, partType: string, partData: any) => {
    if (!partData) return false;

    const key = getPartKey(partData, partType);

    for (let deckIndex = 0; deckIndex < decks.length; deckIndex++) {
      for (let beyIndex = 0; beyIndex < decks[deckIndex].beyblades.length; beyIndex++) {
        if (deckIndex === currentDeckIndex && beyIndex === currentBeyIndex) continue;

        const otherPart = decks[deckIndex].beyblades[beyIndex].parts?.[partType];
        if (!otherPart) continue;

        const otherKey = getPartKey(otherPart, partType);
        if (otherKey === key) {
          // Same deck: check in-deck rule
          if (deckIndex === currentDeckIndex) {
            if (!tournament.allow_repeating_parts_in_deck) return true;
          } else {
            // Different deck: check across-decks rule
            if (!tournament.allow_repeating_parts_across_decks) return true;
          }
        }
      }
    }
    return false;
  };

  const isPartRepeated = (currentDeckIndex: number, currentBeyIndex: number, partType: string, partData: any) => {
    if (!partData) return false;

    const key = getPartKey(partData, partType);

    for (let deckIndex = 0; deckIndex < decks.length; deckIndex++) {
      for (let beyIndex = 0; beyIndex < decks[deckIndex].beyblades.length; beyIndex++) {
        if (deckIndex === currentDeckIndex && beyIndex === currentBeyIndex) continue;

        const otherPart = decks[deckIndex].beyblades[beyIndex].parts?.[partType];
        if (!otherPart) continue;

        const otherKey = getPartKey(otherPart, partType);
        if (otherKey === key) {
          return true;
        }
      }
    }
    return false;
  };

  const countRepeatingParts = () => {
    let inDeckRepeats = 0;
    let acrossDecksRepeats = 0;

    // Count repeating parts within each deck
    if (tournament.allow_repeating_parts_in_deck) {
      for (const deck of decks) {
        const usage: Record<string, number> = {};
        for (const bey of deck.beyblades) {
          const parts = bey.parts || {};
          for (const [partType, partData] of Object.entries(parts)) {
            if (!partData) continue;
            if (partType.startsWith("_")) continue;
            const key = getPartKey(partData, partType);
            usage[key] = (usage[key] || 0) + 1;
          }
        }
        // Count how many extra instances beyond the first
        for (const count of Object.values(usage)) {
          if (count > 1) {
            inDeckRepeats += count - 1;
          }
        }
      }
    }

    // Count repeating parts across decks
    if (tournament.allow_repeating_parts_across_decks && decks.length > 1) {
      const deckParts: Record<number, Record<string, number>> = {};

      // Collect unique parts per deck
      for (let deckIndex = 0; deckIndex < decks.length; deckIndex++) {
        deckParts[deckIndex] = {};
        for (const bey of decks[deckIndex].beyblades) {
          const parts = bey.parts || {};
          for (const [partType, partData] of Object.entries(parts)) {
            if (!partData) continue;
            if (partType.startsWith("_")) continue;
            const key = getPartKey(partData, partType);
            deckParts[deckIndex][key] = (deckParts[deckIndex][key] || 0) + 1;
          }
        }
      }

      // Count parts that appear in multiple decks
      const globalParts: Record<string, number> = {};
      for (const deckPartCounts of Object.values(deckParts)) {
        for (const [key, count] of Object.entries(deckPartCounts)) {
          globalParts[key] = (globalParts[key] || 0) + 1;
        }
      }

      for (const deckCount of Object.values(globalParts)) {
        if (deckCount > 1) {
          acrossDecksRepeats += deckCount - 1;
        }
      }
    }

    return { inDeckRepeats, acrossDecksRepeats };
  };

  const hasDuplicatePartsInDeck = (deckIndex: number) => {
    if (tournament.allow_repeating_parts_in_deck) return false;

    const usage: Record<string, number> = {};
    const deck = decks[deckIndex];
    for (const bey of deck.beyblades) {
      const parts = bey.parts || {};
      for (const [partType, partData] of Object.entries(parts)) {
        if (!partData) continue;
        if (partType.startsWith("_")) continue;
        const key = getPartKey(partData, partType);
        usage[key] = (usage[key] || 0) + 1;
        if (usage[key] > 1) return true;
      }
    }
    return false;
  };

  const hasDuplicatePartsAcrossDecks = () => {
    if (tournament.allow_repeating_parts_across_decks) return false;

    const deckParts: Record<number, Set<string>> = {};

    for (let deckIndex = 0; deckIndex < decks.length; deckIndex++) {
      deckParts[deckIndex] = new Set();
      for (const bey of decks[deckIndex].beyblades) {
        const parts = bey.parts || {};
        for (const [partType, partData] of Object.entries(parts)) {
          if (!partData) continue;
          if (partType.startsWith("_")) continue;
          const key = getPartKey(partData, partType);
          deckParts[deckIndex].add(key);
        }
      }
    }

    // Check if any part appears in multiple decks
    const allParts: Record<string, number> = {};
    for (const parts of Object.values(deckParts)) {
      for (const key of parts) {
        allParts[key] = (allParts[key] || 0) + 1;
        if (allParts[key] > 1) return true;
      }
    }
    return false;
  };

const isFormValid = () => {
  if (!playerName.trim()) {
    console.log("❌ Invalid: playerName missing");
    return false;
  }

  // Check team name for team tournaments
  if (tournament.tournament_settings?.match_format === 'teams' && !teamName.trim()) {
    console.log("❌ Invalid: teamName missing for team tournament");
    return false;
  }

  const normalizedName = playerName.toLowerCase().trim();
  if (existingPlayerNames.includes(normalizedName)) {
    console.log("❌ Invalid: duplicate player name", normalizedName);
    return false;
  }

  const allPartsSelected = decks.every(deck =>
    deck.beyblades.every(bey => {
      const requiredParts = getRequiredParts(bey.isCustomLine ? 'Custom' : 'Basic');
      const complete = requiredParts.every(partType => bey.parts[partType]);
      if (!complete) console.log("❌ Incomplete parts in", bey.id, requiredParts);
      return complete;
    })
  );
  if (!allPartsSelected) return false;

  // Check for duplicate parts within each deck
  for (let i = 0; i < decks.length; i++) {
    if (hasDuplicatePartsInDeck(i)) {
      console.log(`❌ Invalid: duplicate parts in deck ${i + 1}`);
      return false;
    }
  }

  // Check for duplicate parts across different decks
  if (hasDuplicatePartsAcrossDecks()) {
    console.log("❌ Invalid: duplicate parts across decks");
    return false;
  }

  console.log("✅ Form is valid");
  return true;
};


  const handleRegisterClick = () => {
    if (!isFormValid()) {
      alert('Missing Information', 'Please complete all required fields and Beyblade configurations.');
      return;
    }
    setShowReviewModal(true);
  };

  const handleSubmit = async () => {
  if (isSubmitting) return;
  setIsSubmitting(true);

  try {
    const normalizedName = playerName.toLowerCase().trim();
    const { data: existingRegs, error: existingErr } = await supabase
      .from('tournament_registrations')
      .select('player_name')
      .eq('tournament_id', tournament.id)
      .in('status', ['pending', 'confirmed']);
    
    if (existingErr) throw existingErr;
    
    const existingNamesNow = (existingRegs || []).map((r: any) => r.player_name.toLowerCase().trim());
    if (existingNamesNow.includes(normalizedName)) {
      await alert(
        'Name Already Registered',
        'That player name is already registered for this tournament. Please choose a different player name.'
      );
      setIsSubmitting(false);
      return;
    }

    // Validate in-deck duplicates
    for (let i = 0; i < decks.length; i++) {
      if (hasDuplicatePartsInDeck(i)) {
        await alert(
          'Duplicate Parts in Deck',
          `Deck "${decks[i].name}" has duplicate parts. ${tournament.allow_repeating_parts_in_deck ? '' : 'Repeating parts within a single deck is not allowed for this tournament.'} Please remove duplicates before submitting.`
        );
        setIsSubmitting(false);
        return;
      }
    }

    // Validate across-deck duplicates
    if (hasDuplicatePartsAcrossDecks()) {
      await alert(
        'Duplicate Parts Across Decks',
        `One or more parts are used across multiple decks. ${tournament.allow_repeating_parts_across_decks ? '' : 'Repeating parts across different decks is not allowed for this tournament.'} Please remove duplicates before submitting.`
      );
      setIsSubmitting(false);
      return;
    }

    // Create registrations for each deck
    for (let deckIndex = 0; deckIndex < decks.length; deckIndex++) {
      const deck = decks[deckIndex];
      
      const { data: registration, error: regError } = await supabase
        .from('tournament_registrations')
        .insert({
          tournament_id: tournament.id,
          player_name: deck.name,
          team: tournament.tournament_settings?.match_format === 'teams' ? teamName.trim() : null,
          team_with_player: tournament.tournament_settings?.match_format === 'teams' 
            ? `${teamName.trim()} ${playerName.trim()}`
            : playerName.trim(),
          payment_mode: paymentMode,
          status: 'pending',
          payment_status: 'unpaid'
        })
        .select()
        .single();

      if (regError) throw regError;

      // Create beyblades for this deck
      for (const [beyIndex, beyblade] of deck.beyblades.entries()) {
        const beyName = generateBeybladeName(beyblade);

        // 🆕 Proper blade line based on selected parts
        let bladeLine = "Basic";
        if (beyblade.parts.Blade) {
          bladeLine = beyblade.parts.Blade.Line || "Basic";
        } else if (beyblade.parts["Main Blade"]) {
          bladeLine = beyblade.parts["Main Blade"].Line || "Custom";
        } else if (beyblade.isCustomLine) {
          bladeLine = "Custom";
        }
      
      const { data: beyData, error: beyError } = await supabase
        .from('tournament_beyblades')
        .insert({
          registration_id: registration.id,
          beyblade_name: beyName,
          blade_line: bladeLine, // 👈 this is where we fix
          beyblade_index: beyIndex + 1,
          beyblade_label: `Beyblade ${beyIndex + 1}`,
          player_name: deck.name,
          tournament_id: tournament.id
        })
        .select()
        .single();
        
        if (beyError) throw beyError;

        const partsToInsert = Object.entries(beyblade.parts).map(([partType, partData]) => ({
          beyblade_id: beyData.id,
          part_type: partType,
          part_name: getPartDisplayName(partData, partType),
          part_data: partData
        }));

        if (partsToInsert.length > 0) {
          const { error: partsError } = await supabase
            .from('tournament_beyblade_parts')
            .insert(partsToInsert);
          if (partsError) throw partsError;
        }
      }
    }

    // 🔑 Don’t await this — just fire and forget
    alert(
      'Registration Successful',
      `Successfully registered ${decks.length} deck${decks.length > 1 ? 's' : ''} for ${tournament.name}!`
    );

    // Close UI immediately
    setShowReviewModal(false);
    onClose();

    // Refresh in background
    fetchExistingPlayerNames();
    onRegistered?.();

  } catch (err: any) {
    console.error(err);
    await alert('Registration Failed', err?.message || 'Unknown error occurred.');
  } finally {
    setIsSubmitting(false);
  }
};


  const currentDeck = decks[currentDeckIndex];

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
        <div className="bg-slate-950 border border-cyan-500/30 rounded-none shadow-[0_0_40px_rgba(0,200,255,0.3)] w-full max-w-full sm:max-w-2xl lg:max-w-4xl max-h-[95vh] flex flex-col overflow-hidden relative">
          {/* Loading Overlay */}
          {isLoadingParts && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center z-10 rounded-none">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-none animate-spin mx-auto mb-4"></div>
                <p className="text-slate-400">Loading Beyblade parts...</p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-cyan-500 to-purple-500 px-4 sm:px-6 py-4 flex justify-between items-center">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">Tournament Registration</h2>
              <p className="text-cyan-100">{tournament.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-none transition-colors text-white"
            >
              <X size={24} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {partsError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-none p-4">
                <p className="text-red-400 text-sm">{partsError}</p>
                <button onClick={fetchPartsData} className="text-sm underline text-red-400 hover:text-red-300">Try Again</button>
              </div>
            )}

            {/* Tournament Description */}
            {tournament.description && (
              <div className="bg-slate-800/50 border border-cyan-500/20 rounded-none p-4 backdrop-blur-sm">
                <h3 className="text-lg font-semibold text-cyan-400 mb-2">Tournament Details</h3>
                <div
                  className="text-slate-300 prose prose-invert prose-sm max-w-none prose-p:text-slate-300 prose-strong:text-white"
                  dangerouslySetInnerHTML={{ __html: tournament.description }}
                />
              </div>
            )}

            {/* Tournament Rules */}
            <div className="bg-slate-800/50 border border-purple-500/20 rounded-none p-4 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-purple-400 mb-3">Tournament Rules</h3>
              <div className="space-y-2">
                {/* Repeating Parts Rules */}
                <div className="flex items-start space-x-2">
                  <span className={`text-sm ${tournament.allow_repeating_parts_in_deck ? 'text-green-400' : 'text-red-400'}`}>
                    {tournament.allow_repeating_parts_in_deck ? '✓' : '✗'}
                  </span>
                  <span className="text-sm text-slate-300">
                    Repeating parts within decks {tournament.allow_repeating_parts_in_deck ? 'allowed' : 'not allowed'}
                    {tournament.allow_repeating_parts_in_deck && tournament.repeat_part_fee > 0 && (
                      <span className="text-orange-400"> (₱{tournament.repeat_part_fee} per repeat)</span>
                    )}
                  </span>
                </div>

                <div className="flex items-start space-x-2">
                  <span className={`text-sm ${tournament.allow_repeating_parts_across_decks ? 'text-green-400' : 'text-red-400'}`}>
                    {tournament.allow_repeating_parts_across_decks ? '✓' : '✗'}
                  </span>
                  <span className="text-sm text-slate-300">
                    Repeating parts across decks {tournament.allow_repeating_parts_across_decks ? 'allowed' : 'not allowed'}
                    {tournament.allow_repeating_parts_across_decks && tournament.repeat_part_fee > 0 && (
                      <span className="text-orange-400"> (₱{tournament.repeat_part_fee} per repeat)</span>
                    )}
                  </span>
                </div>

                {/* Tournament Settings Rules */}
                {tournament.tournament_settings?.rules && (
                  <>
                    <div className="flex items-start space-x-2">
                      <span className={`text-sm ${tournament.tournament_settings.rules.allow_deck_shuffling ? 'text-green-400' : 'text-red-400'}`}>
                        {tournament.tournament_settings.rules.allow_deck_shuffling ? '✓' : '✗'}
                      </span>
                      <span className="text-sm text-slate-300">
                        Deck shuffling before match {tournament.tournament_settings.rules.allow_deck_shuffling ? 'allowed' : 'not allowed'}
                      </span>
                    </div>

                    <div className="flex items-start space-x-2">
                      <span className={`text-sm ${tournament.tournament_settings.rules.allow_self_finish ? 'text-green-400' : 'text-red-400'}`}>
                        {tournament.tournament_settings.rules.allow_self_finish ? '✓' : '✗'}
                      </span>
                      <span className="text-sm text-slate-300">
                        Self-finish ruling {tournament.tournament_settings.rules.allow_self_finish ? 'implemented' : 'not implemented'}
                      </span>
                    </div>
                  </>
                )}

                {/* Match Format */}
                {tournament.tournament_settings?.match_format && (
                  <div className="flex items-start space-x-2">
                    <span className="text-sm text-cyan-400">ℹ</span>
                    <span className="text-sm text-slate-300">
                      Match format: <span className="text-white font-medium capitalize">{tournament.tournament_settings.match_format}</span>
                      {tournament.tournament_settings.match_format === 'teams' && tournament.tournament_settings.players_per_team && (
                        <span className="text-slate-400"> ({tournament.tournament_settings.players_per_team} players per team)</span>
                      )}
                    </span>
                  </div>
                )}

                {/* Decks and Beyblades */}
                <div className="flex items-start space-x-2">
                  <span className="text-sm text-cyan-400">ℹ</span>
                  <span className="text-sm text-slate-300">
                    {tournament.decks_per_player || 1} deck{(tournament.decks_per_player || 1) > 1 ? 's' : ''} per player max, {tournament.beyblades_per_player || 3} Beyblade{(tournament.beyblades_per_player || 3) > 1 ? 's' : ''} per deck
                  </span>
                </div>

                {/* Tournament Type */}
                <div className="flex items-start space-x-2">
                  <span className="text-sm text-cyan-400">ℹ</span>
                  <span className="text-sm text-slate-300">
                    Tournament type: <span className="text-white font-medium capitalize">{tournament.tournament_type || 'ranked'}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Player Information */}
            <div className="bg-slate-800/50 border border-cyan-500/20 rounded-none p-4 sm:p-6 backdrop-blur-sm">
              <div className="flex items-center mb-4">
                <User className="text-cyan-400 mr-2" size={20} />
                <h3 className="text-lg font-semibold text-cyan-400">Player Information</h3>
              </div>
              
              {(!user || user.id.startsWith('guest-')) && (
                <div className="mb-4 p-3 bg-yellow-500/10 rounded-none border border-yellow-500/30">
                  <p className="text-sm font-medium text-yellow-400">
                    Register your account to see personal stats across multiple tournaments. Tournament entry player name should be the same as account username to view personal stats.
                  </p>
                </div>
              )}

              {user && !user.id.startsWith('guest-') && (
                <div className="mb-4 p-3 bg-slate-900/50 rounded-none border border-cyan-500/20">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={registeringForSelf}
                      onChange={(e) => setRegisteringForSelf(e.target.checked)}
                      className="w-4 h-4 text-cyan-600 border-cyan-500/30 rounded-none focus:ring-cyan-500 bg-slate-800"
                    />
                    <div className="flex items-center space-x-2">
                      <UserCheck size={16} className="text-cyan-400" />
                      <span className="text-sm font-medium text-cyan-400">
                        Register for self? ({user.username})
                      </span>
                    </div>
                  </label>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Team Name (for team tournaments) */}
                {tournament.tournament_settings?.match_format === 'teams' && (
                  <div>
                    <label htmlFor="teamName" className="block text-sm font-medium text-cyan-400 mb-1">
                      Team Name *
                    </label>
                    <input
                      type="text"
                      id="teamName"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="Enter your team name"
                      className="w-full bg-slate-900 border border-cyan-500/30 rounded-none px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="playerName" className="block text-sm font-medium text-cyan-400 mb-1">
                    Player Name *
                  </label>
                  <input
                    type="text"
                    id="playerName"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    disabled={registeringForSelf}
                    placeholder="Enter your player name"
                    className={`w-full bg-slate-900 border border-cyan-500/30 rounded-none px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      registeringForSelf ? 'bg-slate-800 cursor-not-allowed opacity-50' : ''
                    }`}
                  />
                  {playerName.trim() && existingPlayerNames.includes(playerName.toLowerCase().trim()) && (
                    <div className="mt-1 text-xs text-red-400">⚠ This player name is already registered</div>
                  )}
                </div>

                <div className={tournament.tournament_settings?.match_format === 'teams' ? 'sm:col-span-2' : ''}>
                  <label htmlFor="paymentMode" className="block text-sm font-medium text-cyan-400 mb-1">
                    Mode of Payment *
                  </label>
                  <select
                    id="paymentMode"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full bg-slate-900 border border-cyan-500/30 rounded-none px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {tournament.is_free && <option value="free">Free Entry</option>}
                    <option value="cash">Cash</option>
                    <option value="gcash">GCash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Deck Presets Section */}
            {!user?.id.startsWith('guest-') && deckPresets.length > 0 && (
              <div className="bg-slate-800/50 border border-purple-500/20 rounded-none p-4 sm:p-6 backdrop-blur-sm">
                <div className="flex items-center mb-4">
                  <Layers className="text-purple-400 mr-2" size={20} />
                  <h3 className="text-lg font-semibold text-purple-400">Quick Setup with Deck Presets</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-purple-400 mb-1">
                      Select Deck Preset
                    </label>
                    <select
                      value={selectedPreset}
                      onChange={(e) => setSelectedPreset(e.target.value)}
                      className="w-full bg-slate-900 border border-purple-500/30 rounded-none px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">-- Select a preset --</option>
                      {deckPresets.map(preset => (
                        <option key={preset.id} value={preset.id}>
                          {preset.name} ({preset.beyblades.length} Beyblades)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => selectedPreset && loadPreset(selectedPreset)}
                      disabled={!selectedPreset}
                      className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white px-4 py-2 rounded-none hover:from-purple-400 hover:to-purple-500 transition-colors disabled:opacity-50 text-sm shadow-[0_0_15px_rgba(147,51,234,0.3)]"
                    >
                      Load to Current Deck
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Deck Tabs */}
            <div className="bg-slate-800/50 border border-cyan-500/20 rounded-lg p-2 sm:p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-cyan-400 font-semibold text-sm sm:text-base">Decks</h3>
                {tournament.decks_per_player > 1 && decks.length < tournament.decks_per_player && (
                  <button
                    type="button"
                    onClick={addDeck}
                    className="px-3 py-1 text-xs sm:text-sm bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg hover:from-cyan-400 hover:to-purple-500 transition-all shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                  >
                    + Add Deck
                  </button>
                )}
              </div>
            
              {/* Tab bar */}
              <div className="flex items-center space-x-4 overflow-x-auto border-b border-slate-600">
                {decks.map((deck, index) => (
                  <div key={deck.id} className="relative flex items-center">
                    <button
                      onClick={() => setCurrentDeckIndex(index)}
                      className={`pb-2 px-2 text-sm font-medium whitespace-nowrap transition-colors ${
                        currentDeckIndex === index
                          ? "text-cyan-400 border-b-2 border-cyan-400"
                          : "text-slate-400 hover:text-cyan-300"
                      }`}
                    >
                      {deck.name}
                    </button>
                    {decks.length > 1 && (
                      <button
                        onClick={() => removeDeck(index)}
                        className="absolute -right-3 top-0 text-red-400 hover:text-red-300 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Current Deck Configuration */}
            {currentDeck && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">
                    {currentDeck.name} ({currentDeck.beyblades.length} Beyblades)
                  </h3>
                  <div className="text-sm text-slate-400">
                    Deck {currentDeckIndex + 1} of {decks.length}
                  </div>
                </div>

                {currentDeck.beyblades.map((beyblade, beyIndex) => {
                  const statsKey = `${currentDeckIndex}_${beyIndex}`;
                  const showStats = expandedStats[statsKey];
                  
                  return (
                    <div key={beyblade.id} className="bg-slate-900/50 border border-cyan-500/20 rounded-none p-4 backdrop-blur-sm">
                      {/* Beyblade Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
                        {/* Left side: index + title + generated name */}
                        <div className="flex items-start sm:items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-none flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {beyIndex + 1}
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-white">
                              {beyIndex === 0
                                ? '1st'
                                : beyIndex === 1
                                ? '2nd'
                                : beyIndex === 2
                                ? '3rd'
                                : `${beyIndex + 1}th`} Beyblade
                            </h4>
                            <p className="text-slate-400 text-sm font-mono truncate max-w-[200px] sm:max-w-xs">
                              {generateBeybladeName(beyblade) || 'Select all parts to generate name'}
                            </p>
                          </div>
                        </div>
                      
                        {/* Right side: custom line toggle + stats button */}
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`text-xs font-medium ${
                                !beyblade.isCustomLine ? 'text-cyan-400' : 'text-slate-400'
                              }`}
                            >
                              Standard
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={beyblade.isCustomLine}
                                onChange={(e) =>
                                  updateBeyblade(currentDeckIndex, beyIndex, 'isCustomLine', e.target.checked)
                                }
                                className="sr-only"
                              />
                              <div
                                className={`w-8 h-4 rounded-none transition-colors ${
                                  beyblade.isCustomLine ? 'bg-purple-500' : 'bg-slate-600'
                                }`}
                              >
                                <div
                                  className={`w-3 h-3 bg-white rounded-none shadow transform transition-transform ${
                                    beyblade.isCustomLine ? 'translate-x-4' : 'translate-x-0'
                                  } mt-0.5 ml-0.5`}
                                ></div>
                              </div>
                            </label>
                            <span
                              className={`text-xs font-medium ${
                                beyblade.isCustomLine ? 'text-purple-400' : 'text-slate-400'
                              }`}
                            >
                              Custom
                            </span>
                          </div>
                      
                          <button
                            onClick={() => toggleStats(currentDeckIndex, beyIndex)}
                            className="flex items-center space-x-1 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded-none transition-colors text-sm"
                          >
                            {showStats ? <EyeOff size={14} /> : <Eye size={14} />}
                            <span className="hidden sm:inline">
                              {showStats ? 'Hide' : 'Show'} Stats
                            </span>
                          </button>
                        </div>
                      </div>

                      {/* Generated Name */}
                      {/* <div className="mb-4">
                        <label className="block text-sm font-medium text-cyan-400 mb-1">
                          Generated Name
                        </label>
                        <div className="bg-slate-800 border border-cyan-500/30 rounded-none px-3 py-2 text-sm font-mono text-slate-300">
                          {generateBeybladeName(beyblade) || 'Select all parts to generate name'}
                        </div>
                      </div> */}

                      {/* Parts Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {getRequiredParts(beyblade.isCustomLine ? 'Custom' : 'Basic').map((partType) => (
                          <div key={partType}>
                            <label className="block text-sm font-medium text-cyan-400 mb-1">
                              {partType} *
                            </label>
                            <select
                              value={beyblade.parts[partType] ? JSON.stringify(beyblade.parts[partType]) : ''}
                              onChange={(e) => e.target.value && updatePart(currentDeckIndex, beyIndex, partType, JSON.parse(e.target.value))}
                              className="w-full bg-slate-900 border border-cyan-500/30 rounded-none px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            >
                              <option value="">Select {partType}</option>
                              {getPartOptions(partType).map((part: any, idx) => (
                                <option key={idx} value={JSON.stringify(part)}>
                                  {getPartDisplayName(part, partType)}
                                </option>
                              ))}
                            </select>

                            {/* Duplicate part warning - blocking error */}
                            {beyblade.parts[partType] && isPartUsedElsewhere(currentDeckIndex, beyIndex, partType, beyblade.parts[partType]) && (
                              <div className="mt-1 text-xs text-red-400">⚠ This part is used elsewhere</div>
                            )}

                            {/* Repeated part warning - informational only */}
                            {beyblade.parts[partType] &&
                             !isPartUsedElsewhere(currentDeckIndex, beyIndex, partType, beyblade.parts[partType]) &&
                             isPartRepeated(currentDeckIndex, beyIndex, partType, beyblade.parts[partType]) && (
                              <div className="mt-1 text-xs text-orange-400">
                                ℹ This part has been used before. Repetition is allowed under current rules.
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Stats Display */}
                      {showStats && Object.keys(beyblade.parts).length > 0 && (
                        <div className="mt-4">
                          <StatBar stats={calculateStats(beyblade.parts)} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-cyan-500/20">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 border border-slate-600 text-slate-300 rounded-none hover:bg-slate-700 hover:text-white transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>

              <button
                onClick={handleRegisterClick}
                disabled={!isFormValid() || isLoadingParts || isSubmitting}
                className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-none hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 transition-all duration-200 shadow-[0_0_20px_rgba(0,200,255,0.3)] flex items-center space-x-2"
              >
                <span>Register</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-slate-950 border border-cyan-500/30 rounded-none shadow-[0_0_40px_rgba(0,200,255,0.3)] max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Review Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-4 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">Review Registration</h2>
                  <p className="text-green-100">{tournament.name}</p>
                </div>
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="p-2 hover:bg-white/20 rounded-none transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Review Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
              {/* Player Summary */}
              <div className="mb-6 bg-slate-800/50 border border-green-500/20 rounded-none p-4">
                <h3 className="text-lg font-bold text-white mb-3">Registration Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Player Name:</span>
                    <span className="ml-2 text-white font-medium">{playerName}</span>
                  </div>
                  {tournament.tournament_settings?.match_format === 'teams' && (
                    <div>
                      <span className="text-slate-400">Team Name:</span>
                      <span className="ml-2 text-white font-medium">{teamName}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-400">Payment Mode:</span>
                    <span className="ml-2 text-white capitalize">{paymentMode.replace('_', ' ')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Total Decks:</span>
                    <span className="ml-2 text-white">{decks.length}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Total Beyblades:</span>
                    <span className="ml-2 text-white">{decks.reduce((sum, deck) => sum + deck.beyblades.length, 0)}</span>
                  </div>
                </div>

                {!tournament.is_free && (() => {
                  const { inDeckRepeats, acrossDecksRepeats } = countRepeatingParts();
                  const totalRepeats = inDeckRepeats + acrossDecksRepeats;
                
                  const baseEntryFee = tournament.entry_fee || 0;
                  const repeatFee = tournament.repeat_part_fee || 0;
                
                  // ✅ Each deck is one entry fee
                  const deckFees = decks.length * baseEntryFee;
                
                  const additionalFee = totalRepeats * repeatFee;
                  const totalFee = deckFees + additionalFee;
                
                  return totalRepeats > 0 || baseEntryFee > 0 ? (
                    <div className="mt-4 pt-4 border-t border-green-500/20">
                      <h4 className="text-md font-semibold text-white mb-2">Entry Fee Breakdown</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Base Entry Fee (₱{baseEntryFee.toFixed(2)} × {decks.length} decks):</span>
                          <span className="text-white">₱{deckFees.toFixed(2)}</span>
                        </div>
                        {totalRepeats > 0 && repeatFee > 0 && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Repeating Parts ({totalRepeats} × ₱{repeatFee}):</span>
                              <span className="text-white">₱{additionalFee.toFixed(2)}</span>
                            </div>
                            {inDeckRepeats > 0 && (
                              <div className="flex justify-between text-xs pl-4">
                                <span className="text-slate-500">↳ Within decks:</span>
                                <span className="text-slate-400">{inDeckRepeats} parts</span>
                              </div>
                            )}
                            {acrossDecksRepeats > 0 && (
                              <div className="flex justify-between text-xs pl-4">
                                <span className="text-slate-500">↳ Across decks:</span>
                                <span className="text-slate-400">{acrossDecksRepeats} parts</span>
                              </div>
                            )}
                          </>
                        )}
                        <div className="flex justify-between font-bold text-lg pt-2 border-t border-green-500/20">
                          <span className="text-green-400">Total Entry Fee:</span>
                          <span className="text-green-400">₱{totalFee.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ) : null;
                })()}

              </div>

              {/* Deck Review */}
              <div className="space-y-6">
                {decks.map((deck, deckIndex) => (
                  <div key={deck.id} className="bg-slate-800/50 border border-cyan-500/20 rounded-none p-4">
                    <h4 className="text-lg font-bold text-white mb-4 flex items-center">
                      <div className="w-6 h-6 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-none flex items-center justify-center text-white font-bold text-sm mr-2">
                        {deckIndex + 1}
                      </div>
                      {deck.name}
                    </h4>
                    
                    <div className="space-y-3">
                      {deck.beyblades.map((beyblade, beyIndex) => (
                        <div key={beyblade.id} className="bg-slate-900/50 rounded-none p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-white font-medium">
                              {beyIndex === 0 ? '1st' : beyIndex === 1 ? '2nd' : beyIndex === 2 ? '3rd' : `${beyIndex + 1}th`} Beyblade
                            </span>
{(() => {
  let line = "Standard";

  if (beyblade.parts.Blade) {
    line = beyblade.parts.Blade.Line || "Basic";
  } else if (beyblade.parts["Main Blade"]) {
    line = beyblade.parts["Main Blade"].Line || "Custom";
  } else if (beyblade.isCustomLine) {
    line = "Custom";
  }

  return (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${
        line === "Custom"
          ? "bg-purple-500/20 text-purple-400"
          : line === "Unique"
          ? "bg-pink-500/20 text-pink-400"
          : line === "X-Over"
          ? "bg-orange-500/20 text-orange-400"
          : "bg-cyan-500/20 text-cyan-400"
      }`}
    >
      {line} Line
    </span>
  );
})()}

                          </div>
                          <div className="text-sm font-mono text-slate-300 bg-slate-800/50 px-3 py-2 rounded-none">
                            {generateBeybladeName(beyblade) || 'Incomplete'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Review Actions */}
            <div className="bg-slate-900/50 px-6 py-4 border-t border-slate-700 flex justify-end space-x-3">
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 bg-slate-800 border border-slate-600 text-slate-300 rounded-none hover:bg-slate-700 hover:text-white transition-colors"
                disabled={isSubmitting}
              >
                Back to Edit
              </button>

              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-none hover:from-green-400 hover:to-emerald-500 disabled:opacity-50 transition-all duration-200 shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="white" strokeOpacity="0.2" strokeWidth="4"/>
                      <path d="M22 12a10 10 0 00-10-10" stroke="white" strokeWidth="4" strokeLinecap="round"/>
                    </svg>
                    <span>Registering...</span>
                  </>
                ) : (
                  <span>Confirm Registration</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}