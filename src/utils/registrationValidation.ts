export interface BeybladeValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PartUsage {
  partName: string;
  partType: string;
  usageCount: number;
  beybladeIndexes: number[];
  deckIndexes: number[];
}

export interface ValidationContext {
  tournament: {
    allow_repeating_parts_in_deck: boolean;
    allow_repeating_parts_across_decks: boolean;
    beyblades_per_player: number;
    decks_per_player: number;
  };
  beyblades: Array<{
    beyblade_name: string;
    blade_line: string;
    parts: Array<{
      part_type: string;
      part_name: string;
      part_data: any;
    }>;
    deck_index?: number;
    beyblade_index?: number;
  }>;
}

export function validateBeybladeRegistration(context: ValidationContext): BeybladeValidationResult {
  const { tournament, beyblades } = context;
  const errors: string[] = [];
  const warnings: string[] = [];

  // Track part usage across all beyblades
  const partUsageMap = new Map<string, PartUsage>();

  // Analyze each beyblade
  beyblades.forEach((beyblade, beybladeIndex) => {
    const deckIndex = beyblade.deck_index || Math.floor(beybladeIndex / tournament.beyblades_per_player);
    
    // Track parts within this beyblade
    const partsInThisBeyblade = new Map<string, number>();
    
    beyblade.parts.forEach((part) => {
      const partKey = `${part.part_type}:${part.part_name}`;
      
      // Count usage within this beyblade
      partsInThisBeyblade.set(partKey, (partsInThisBeyblade.get(partKey) || 0) + 1);
      
      // Track global usage
      if (!partUsageMap.has(partKey)) {
        partUsageMap.set(partKey, {
          partName: part.part_name,
          partType: part.part_type,
          usageCount: 0,
          beybladeIndexes: [],
          deckIndexes: []
        });
      }
      
      const usage = partUsageMap.get(partKey)!;
      usage.usageCount++;
      if (!usage.beybladeIndexes.includes(beybladeIndex)) {
        usage.beybladeIndexes.push(beybladeIndex);
      }
      if (!usage.deckIndexes.includes(deckIndex)) {
        usage.deckIndexes.push(deckIndex);
      }
    });

    // Check for repeating parts within this beyblade
    partsInThisBeyblade.forEach((count, partKey) => {
      if (count > 1 && !tournament.allow_repeating_parts_in_deck) {
        const [partType, partName] = partKey.split(':');
        errors.push(
          `Beyblade ${beybladeIndex + 1}: "${partName}" (${partType}) is used ${count} times. ` +
          `Repeating parts within one beyblade are not allowed in this tournament.`
        );
      }
    });
  });

  // Check for repeating parts across different beyblades/decks
  partUsageMap.forEach((usage, partKey) => {
    const [partType, partName] = partKey.split(':');
    
    // Check if part is used in multiple beyblades
    if (usage.beybladeIndexes.length > 1) {
      // Check if it's across different decks
      const isAcrossDecks = usage.deckIndexes.length > 1;
      
      if (isAcrossDecks && !tournament.allow_repeating_parts_across_decks) {
        errors.push(
          `"${partName}" (${partType}) is used across multiple decks (decks ${usage.deckIndexes.map(i => i + 1).join(', ')}). ` +
          `Repeating parts across decks are not allowed in this tournament.`
        );
      } else if (!isAcrossDecks && !tournament.allow_repeating_parts_in_deck) {
        // Same deck, different beyblades
        errors.push(
          `"${partName}" (${partType}) is used in multiple beyblades within the same deck. ` +
          `Repeating parts within a deck are not allowed in this tournament.`
        );
      }
    }
  });

  // Generate warnings for allowed but notable repetitions
  if (tournament.allow_repeating_parts_in_deck || tournament.allow_repeating_parts_across_decks) {
    partUsageMap.forEach((usage, partKey) => {
      const [partType, partName] = partKey.split(':');
      
      if (usage.usageCount > 1) {
        warnings.push(
          `"${partName}" (${partType}) is used ${usage.usageCount} times across your registration.`
        );
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

export function calculateRepeatingPartsFee(
  context: ValidationContext,
  baseEntryFee: number,
  repeatPartFee: number
): { totalFee: number; additionalFee: number; breakdown: Array<{ part: string; count: number; fee: number }> } {
  const { tournament, beyblades } = context;
  
  if (!tournament.allow_repeating_parts_in_deck && !tournament.allow_repeating_parts_across_decks) {
    return { totalFee: baseEntryFee, additionalFee: 0, breakdown: [] };
  }

  const partUsageMap = new Map<string, number>();
  const breakdown: Array<{ part: string; count: number; fee: number }> = [];

  // Count all part usage
  beyblades.forEach((beyblade) => {
    beyblade.parts.forEach((part) => {
      const partKey = `${part.part_type}:${part.part_name}`;
      partUsageMap.set(partKey, (partUsageMap.get(partKey) || 0) + 1);
    });
  });

  let additionalFee = 0;

  // Calculate fees for repeated parts
  partUsageMap.forEach((count, partKey) => {
    if (count > 1) {
      const [partType, partName] = partKey.split(':');
      const extraUsages = count - 1; // First usage is free
      const partFee = extraUsages * repeatPartFee;
      
      additionalFee += partFee;
      breakdown.push({
        part: `${partName} (${partType})`,
        count: extraUsages,
        fee: partFee
      });
    }
  });

  return {
    totalFee: baseEntryFee + additionalFee,
    additionalFee,
    breakdown
  };
}