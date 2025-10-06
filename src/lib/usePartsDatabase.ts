// hooks/usePartsDatabase.ts
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export interface AllPartsData {
  blades: string[];
  ratchets: string[];
  bits: string[];
  lockchips: string[];
  assistblades: string[];
}

export function usePartsDatabase() {
  const [partsData, setPartsData] = useState<AllPartsData>({
    blades: [],
    ratchets: [],
    bits: [],
    lockchips: [],
    assistblades: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchParts() {
      setLoading(true);

      const [bladesRes, ratchetsRes, bitsRes, lockchipsRes, assistRes] = await Promise.all([
        supabase.from("beypart_blade").select("Blades"),
        supabase.from("beypart_ratchet").select("Ratchet"),
        supabase.from("beypart_bit").select("Bit, Shortcut"),
        supabase.from("beypart_lockchip").select("Lockchip"),
        supabase.from("beypart_assistblade").select('"Assist Blade"'), // must quote because of space
      ]);
      
      setPartsData({
        blades: bladesRes.data?.map((b: any) => b.Blades) || [],
        ratchets: ratchetsRes.data?.map((r: any) => r.Ratchet) || [],
        bits: bitsRes.data?.flatMap((b: any) => [b.Bit, b.Shortcut]).filter(Boolean) || [],
        lockchips: lockchipsRes.data?.map((l: any) => l.Lockchip) || [],
        assistblades: assistRes.data?.map((a: any) => a["Assist Blade"]) || [],
      });

      console.log("Fetched parts:", {
        blades: bladesRes.data,
        ratchets: ratchetsRes.data,
        bits: bitsRes.data,
        lockchips: lockchipsRes.data,
        assistblades: assistRes.data
      });
      
      setLoading(false);
    }

    fetchParts();
  }, []);

  return { partsData, loading };
}
