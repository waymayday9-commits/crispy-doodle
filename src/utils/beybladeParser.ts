export interface ParsedBeyblade {
  blade?: string;
  ratchet?: string;
  bit?: string;
  lockchip?: string;
  mainBlade?: string;
  assistBlade?: string;
  isCustom: boolean;
}

export interface AllPartsData {
  blades: any[];
  ratchets: any[];
  bits: any[];
  lockchips: any[];
  assistBlades: any[];
}

export interface PartStats {
  name: string;
  usage: number;
  wins: number;
  losses: number;
  winRate: number;
  wilson: number;
}

export interface BuildStats {
  build: string;
  player: string;
  wins: number;
  losses: number;
  winRate: number;
  wilson: number;
}

export function calculateWilsonScore(wins: number, total: number, z: number = 1.96): number {
  if (total === 0) return 0;
  const phat = wins / total;
  const denom = 1 + z * z / total;
  const center = phat + z * z / (2 * total);
  const spread = z * Math.sqrt((phat * (1 - phat) + z * z / (4 * total)) / total);
  return Math.round(((center - spread) / denom) * 1000) / 1000;
}

function tryParseStandardBeyblade(beybladeName: string, bladeLine: string, partsData: AllPartsData): ParsedBeyblade | null {
  let remainingName = beybladeName;
  
  const bitResult = findBit(remainingName, partsData.bits);
  if (!bitResult) {
    return null;
  }
  
  remainingName = remainingName.slice(0, remainingName.length - bitResult.bitName.length).trim();
  
  const ratchetResult = findRatchet(remainingName, partsData.ratchets);
  if (!ratchetResult) {
    return null;
  }
  
  remainingName = remainingName.slice(0, remainingName.length - ratchetResult.ratchetName.length).trim();
  
  const bladeResult = findBlade(remainingName, partsData.blades.filter(blade => 
    blade.Line === bladeLine
  ));
  if (!bladeResult) {
    return null;
  }
  
  const result = {
    isCustom: false,
    blade: bladeResult.bladeName,
    ratchet: ratchetResult.ratchetName,
    bit: bitResult.bitName
  };
  
  return result;
}

function tryParseCustomBeyblade(beybladeName: string, partsData: AllPartsData): ParsedBeyblade | null {
  let remainingName = beybladeName;
  
  const lockchipResult = findLockchip(beybladeName, partsData.lockchips);
  if (!lockchipResult) {
    return null;
  }
  
  remainingName = beybladeName.slice(lockchipResult.lockchipName.length);
  
  const bitResult = findBit(remainingName, partsData.bits);
  if (!bitResult) {
    return null;
  }
  
  remainingName = remainingName.slice(0, remainingName.length - bitResult.bitName.length).trim();
  
  const ratchetResult = findRatchet(remainingName, partsData.ratchets);
  if (!ratchetResult) {
    return null;
  }
  
  remainingName = remainingName.slice(0, remainingName.length - ratchetResult.ratchetName.length).trim();
  
  const assistBladeResult = findAssistBlade(remainingName, partsData.assistBlades);
  if (!assistBladeResult) {
    return null;
  }
  
  remainingName = remainingName.slice(0, remainingName.length - assistBladeResult.assistBladeName.length).trim();
  
  const mainBladeResult = findBlade(remainingName, partsData.blades.filter(blade => 
    blade.Line === 'Custom'
  ));
  if (!mainBladeResult) {
    return null;
  }
  
  const result = {
    isCustom: true,
    lockchip: lockchipResult.lockchipName,
    mainBlade: mainBladeResult.bladeName,
    assistBlade: assistBladeResult.assistBladeName,
    ratchet: ratchetResult.ratchetName,
    bit: bitResult.bitName
  };
  
  return result;
}

function findBit(remainingName: string, bits: any[]): { bit: any; bitName: string } | null {
  const sortedBits = [...bits].sort((a, b) => {
    const aName = a.Shortcut || a.Bit || '';
    const bName = b.Shortcut || b.Bit || '';
    return bName.length - aName.length;
  });
  
  for (const bit of sortedBits) {
    const shortcut = bit.Shortcut;
    if (shortcut && remainingName.endsWith(shortcut)) {
      return { bit, bitName: shortcut };
    }
  }
  
  for (const bit of sortedBits) {
    const fullName = bit.Bit;
    if (fullName && remainingName.endsWith(fullName)) {
      return { bit, bitName: bit.Shortcut || fullName };
    }
  }
  
  return null;
}

function findRatchet(remainingName: string, ratchets: any[]): { ratchet: any; ratchetName: string } | null {
  const sortedRatchets = [...ratchets].sort((a, b) => {
    const aName = a.Ratchet || '';
    const bName = b.Ratchet || '';
    return bName.length - aName.length;
  });
  
  for (const ratchet of sortedRatchets) {
    const ratchetName = ratchet.Ratchet;
    if (ratchetName && remainingName.endsWith(ratchetName)) {
      return { ratchet, ratchetName };
    }
  }
  
  return null;
}

function findBlade(remainingName: string, blades: any[]): { blade: any; bladeName: string } | null {
  for (const blade of blades) {
    const bladeName = blade.Blades;
    if (bladeName && remainingName === bladeName) {
      return { blade, bladeName };
    }
  }
  
  return null;
}

function findLockchip(beybladeName: string, lockchips: any[]): { lockchip: any; lockchipName: string } | null {
  const sortedLockchips = [...lockchips].sort((a, b) => {
    const aName = a.Lockchip || '';
    const bName = b.Lockchip || '';
    return bName.length - aName.length;
  });
  
  for (const lockchip of sortedLockchips) {
    const lockchipName = lockchip.Lockchip;
    if (lockchipName && beybladeName.startsWith(lockchipName)) {
      return { lockchip, lockchipName };
    }
  }
  
  return null;
}

function findAssistBlade(remainingName: string, assistBlades: any[]): { assistBlade: any; assistBladeName: string } | null {
  const sortedAssistBlades = [...assistBlades].sort((a, b) => {
    const aName = a['Assist Blade'] || '';
    const bName = b['Assist Blade'] || '';
    return bName.length - aName.length;
  });
  
  for (const assistBlade of sortedAssistBlades) {
    const assistBladeName = assistBlade['Assist Blade'];
    if (assistBladeName && remainingName.endsWith(assistBladeName)) {
      return { assistBlade, assistBladeName };
    }
  }
  
  return null;
}

export function parseBeybladeName(beybladeName: string, bladeLine: string | undefined, partsData: AllPartsData): ParsedBeyblade {
  if (!beybladeName || !beybladeName.trim()) {
    return { isCustom: false };
  }
  
  const bladeLinesToTry = ['Basic', 'Unique', 'X-Over', 'Custom'];
  
  for (const lineToTry of bladeLinesToTry) {
    if (lineToTry === 'Custom') {
      const customResult = tryParseCustomBeyblade(beybladeName, partsData);
      if (customResult) {
        return customResult;
      }
    } else {
      const standardResult = tryParseStandardBeyblade(beybladeName, lineToTry, partsData);
      if (standardResult) {
        return standardResult;
      }
    }
  }
  
  return { isCustom: false };
}