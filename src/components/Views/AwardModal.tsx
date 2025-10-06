import React, { useState, useEffect } from "react";
import {
  X,
  Award,
  Upload,
  Trophy,
  Crown,
  Medal,
  Star,
  Target,
  Zap,
  Plus,
  Edit2,
  Trash2,
} from "lucide-react";
import Select from "react-select";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useConfirmation } from "../../context/ConfirmationContext";

interface AwardModalProps {
  tournamentId: string;
  onClose: () => void;
}

const PREDEFINED_ICONS = [
  { name: "Trophy", icon: Trophy, color: "text-yellow-500" },
  { name: "Crown", icon: Crown, color: "text-yellow-400" },
  { name: "Medal", icon: Medal, color: "text-orange-500" },
  { name: "Star", icon: Star, color: "text-purple-500" },
  { name: "Award", icon: Award, color: "text-blue-500" },
  { name: "Target", icon: Target, color: "text-green-500" },
  { name: "Zap", icon: Zap, color: "text-red-500" },
];

// Default awards with proper icons
const PREDEFINED_AWARDS: Record<
  string,
  { label: string; icon_data: { name: string; color: string } }
> = {
  champion: {
    label: "Champion",
    icon_data: { name: "Trophy", color: "text-yellow-500" },
  },
  swiss_king: {
    label: "Swiss King",
    icon_data: { name: "Crown", color: "text-yellow-400" },
  },
  second_place: {
    label: "2nd Place",
    icon_data: { name: "Medal", color: "text-orange-500" },
  },
  third_place: {
    label: "3rd Place",
    icon_data: { name: "Medal", color: "text-orange-500" },
  },
  fourth_place: {
    label: "4th Place",
    icon_data: { name: "Medal", color: "text-orange-500" },
  },
  fifth_place: {
    label: "5th Place",
    icon_data: { name: "Medal", color: "text-orange-500" },
  },
  sixth_place: {
    label: "6th Place",
    icon_data: { name: "Medal", color: "text-orange-500" },
  },
  seventh_place: {
    label: "7th Place",
    icon_data: { name: "Medal", color: "text-orange-500" },
  },
  eighth_place: {
    label: "8th Place",
    icon_data: { name: "Medal", color: "text-orange-500" },
  },
};

export function AwardModal({ tournamentId, onClose }: AwardModalProps) {
  const { user } = useAuth();
  const { alert } = useConfirmation();

  const [tournament, setTournament] = useState<any>(null);
  const [awards, setAwards] = useState<any[]>([]);

  // players now have id + name
  const [playerOptions, setPlayerOptions] = useState<
    { value: string; label: string }[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAward, setEditingAward] = useState<any>(null);

  // form state
  const [awardName, setAwardName] = useState("");
  const [awardTag, setAwardTag] = useState("misc");
  const [awardee, setAwardee] = useState<{ id: string; name: string } | null>(null);
  const [iconType, setIconType] = useState<"predefined" | "upload">("predefined");
  const [selectedIcon, setSelectedIcon] = useState("Trophy");
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchTournament();
    fetchAwards();
    fetchPlayers();
  }, [tournamentId]);

  const fetchTournament = async () => {
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .eq("id", tournamentId)
      .single();
    if (!error) setTournament(data);
  };

  // new state
  const [showDefaultPrompt, setShowDefaultPrompt] = useState(false);
  const fetchAwards = async () => {
    try {
      const { data: existing, error } = await supabase
        .from("tournament_awards")
        .select("*")
        .eq("tournament_id", tournamentId);

      if (error) throw error;

      if (!existing || existing.length === 0) {
        setShowDefaultPrompt(true); // trigger confirm popup
      } else {
        setAwards(existing);
      }
    } catch (err) {
      console.error("Error fetching awards:", err.message || err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from("tournament_registrations")
        .select("player_id, player_name")
        .eq("tournament_id", tournamentId)
        .order("player_name", { ascending: true });

      if (error) throw error;

      const cleanData = (data || []).filter((r) => r.player_name);

      // deduplicate by player_id
      const unique = new Map();
      cleanData.forEach((r) => {
        if (!unique.has(r.player_id)) {
          unique.set(r.player_id, r.player_name);
        }
      });

      setPlayerOptions(
        Array.from(unique.entries()).map(([id, name]) => ({
          value: id,
          label: name,
        }))
      );
    } catch (err) {
      console.error("Error fetching players:", err);
    }
  };

  const resetForm = () => {
    setAwardName("");
    setAwardTag("misc");
    setAwardee(null);
    setIconType("predefined");
    setSelectedIcon("Trophy");
    setUploadedImage(null);
    setImagePreview(null);
    setEditingAward(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("File Too Large", "Max file size 5MB.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Invalid File", "Please upload an image file.");
      return;
    }
    setUploadedImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const saveAward = async () => {
    if (!awardName.trim()) {
      await alert("Missing Info", "Please enter an award name.");
      return;
    }
    if (!awardee) {
      await alert("Missing Info", "Please select a player.");
      return;
    }

    setSubmitting(true);
    try {
      let iconUrl: string | null = null;
      let iconData: any = null;
      let tag = awardTag || "misc";

      if (PREDEFINED_AWARDS[tag]) {
        iconData = PREDEFINED_AWARDS[tag].icon_data;
      }

      if (iconType === "upload" && uploadedImage) {
        const ext = uploadedImage.name.split(".").pop();
        const fileName = `award_${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("award-images")
          .upload(fileName, uploadedImage, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("award-images")
          .getPublicUrl(fileName);
        iconUrl = urlData.publicUrl;
      } else if (!iconData) {
        iconData = {
          name: selectedIcon,
          color:
            PREDEFINED_ICONS.find((i) => i.name === selectedIcon)?.color ||
            "text-yellow-500",
        };
      }

      if (editingAward) {
        await supabase
          .from("tournament_awards")
          .update({
            award_name: awardName.trim(),
            award_tag: tag,
            player_id: awardee?.id || null,
            player_name: awardee?.name || "",
            icon_type: iconType,
            icon_url: iconUrl,
            icon_data: iconData,
          })
          .eq("id", editingAward.id);
      } else {
        await supabase.from("tournament_awards").insert({
          tournament_id: tournamentId,
          player_id: awardee?.id || null,
          player_name: awardee?.name || "",
          award_name: awardName.trim(),
          award_tag: tag,
          icon_type: iconType,
          icon_url: iconUrl,
          icon_data: iconData,
          awarded_by: user?.id,
          awarded_at: new Date().toISOString(),
        });
      }

      await fetchAwards();
      resetForm();
      setShowForm(false);
    } catch (err) {
      console.error("Error saving award:", err);
      await alert("Error", "Failed to save award.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteAward = async (id: string) => {
    try {
      await supabase.from("tournament_awards").delete().eq("id", id);
      setAwards((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Error deleting award:", err);
    }
  };

  const getIconComponent = (iconData: any) => {
    if (!iconData?.name) return Award;
    return (
      PREDEFINED_ICONS.find((i) => i.name === iconData.name)?.icon || Award
    );
  };
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-950 border border-cyan-500/30 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-4 flex justify-between items-center text-white">
          <div>
            <h2 className="text-2xl font-bold flex items-center">
              <Award size={24} className="mr-2" /> Tournament Awards
            </h2>
            <p className="text-yellow-100">{tournament?.name}</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="p-2 hover:bg-white/20 rounded-full"
            >
              <Plus size={20} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Awards List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {awards.length === 0 ? (
            <p className="text-slate-400 text-center">No awards yet.</p>
          ) : (
            awards.map((a) => {
              const IconComp = getIconComponent(a.icon_data);
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-700"
                >
                  <div className="flex items-center space-x-3">
                    {a.icon_type === "predefined" ? (
                      <IconComp
                        size={20}
                        className={a.icon_data?.color || "text-yellow-500"}
                      />
                    ) : (
                      <img src={a.icon_url} className="w-6 h-6 rounded" />
                    )}
                    <div>
                      <div className="text-white font-medium">
                        {a.award_name}
                      </div>
                      <div className="text-sm text-slate-400">
                        {a.player_name}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setEditingAward(a);
                        setAwardName(a.award_name);
                        setAwardTag(a.award_tag || "misc");
                        setAwardee(
                          a.player_id
                            ? { id: a.player_id, name: a.player_name }
                            : null
                        );
                        setIconType(a.icon_type);
                        setSelectedIcon(a.icon_data?.name || "Trophy");
                        setImagePreview(a.icon_url || null);
                        setShowForm(true);
                      }}
                      className="text-blue-400 hover:text-blue-500"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => deleteAward(a.id)}
                      className="text-red-400 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Award Form Popup */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-slate-950 border border-cyan-500/30 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl text-yellow-400 font-bold flex items-center">
                <Award size={20} className="mr-2" />
                {editingAward ? "Edit Award" : "Create Award"}
              </h3>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="p-2 hover:bg-white/20 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            {/* Award Name */}
            <div>
              <label className="block text-sm text-yellow-400 mb-2">
                Award Name *
              </label>
              <input
                type="text"
                value={awardName}
                onChange={(e) => setAwardName(e.target.value)}
                className="w-full bg-slate-900 border border-yellow-500/30 rounded-lg px-4 py-3 text-white"
              />
            </div>

            {/* Award Tag */}
            <div>
              <label className="block text-sm text-yellow-400 mb-2">
                Award Tag
              </label>
              <select
                value={awardTag}
                onChange={(e) => setAwardTag(e.target.value)}
                className="w-full bg-slate-900 border border-yellow-500/30 rounded-lg px-4 py-3 text-white"
              >
                <option value="misc">Misc</option>
                {Object.entries(PREDEFINED_AWARDS).map(([tag, def]) => (
                  <option key={tag} value={tag}>
                    {def.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Player Select */}
            <div>
              <label className="block text-sm text-yellow-400 mb-2">
                Awardee *
              </label>
              <Select
                value={
                  awardee ? { value: awardee.id, label: awardee.name } : null
                }
                onChange={(opt) =>
                  setAwardee(opt ? { id: opt.value, name: opt.label } : null)
                }
                options={playerOptions}
                isClearable
                isSearchable
                placeholder="Select player"
              />
            </div>

            {/* Icon Type Toggle */}
            <div>
              <label className="block text-sm text-yellow-400 mb-2">
                Award Icon *
              </label>
              <div className="flex space-x-4 mb-3">
                <label className="flex items-center space-x-2 text-slate-300">
                  <input
                    type="radio"
                    value="predefined"
                    checked={iconType === "predefined"}
                    onChange={() => setIconType("predefined")}
                  />
                  <span>Predefined</span>
                </label>
                <label className="flex items-center space-x-2 text-slate-300">
                  <input
                    type="radio"
                    value="upload"
                    checked={iconType === "upload"}
                    onChange={() => setIconType("upload")}
                  />
                  <span>Upload</span>
                </label>
              </div>

              {iconType === "predefined" && (
                <div className="grid grid-cols-3 gap-3">
                  {PREDEFINED_ICONS.map((def) => {
                    const IconComp = def.icon;
                    return (
                      <button
                        key={def.name}
                        onClick={() => setSelectedIcon(def.name)}
                        className={`p-3 border rounded-lg flex flex-col items-center space-y-1 ${
                          selectedIcon === def.name
                            ? "border-yellow-500 bg-yellow-500/20"
                            : "border-slate-600"
                        }`}
                      >
                        <IconComp size={20} className={def.color} />
                        <span className="text-xs text-white">{def.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {iconType === "upload" && (
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="w-full text-sm text-slate-300"
                  />
                  {imagePreview && (
                    <img
                      src={imagePreview}
                      className="w-16 h-16 object-cover rounded border border-slate-700"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Preview */}
            {awardName && awardee && (
              <div className="bg-slate-800/50 border border-yellow-500/20 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-yellow-400 mb-2">
                  Preview
                </h4>
                <div className="flex items-center space-x-3">
                  {(() => {
                    const IconComp =
                      PREDEFINED_ICONS.find((i) => i.name === selectedIcon)
                        ?.icon || Trophy;
                    return (
                      <IconComp
                        size={24}
                        className={
                          PREDEFINED_ICONS.find(
                            (i) => i.name === selectedIcon
                          )?.color || "text-yellow-500"
                        }
                      />
                    );
                  })()}
                  <div>
                    <div className="text-white font-medium">{awardName}</div>
                    <div className="text-sm text-slate-400">
                      {awardee.name}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
                className="px-4 py-2 bg-slate-800 border border-slate-600 text-slate-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={saveAward}
                disabled={submitting}
                className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg"
              >
                {submitting
                  ? "Saving..."
                  : editingAward
                  ? "Update Award"
                  : "Create Award"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Default Awards Prompt */}
      {showDefaultPrompt && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
          <div className="bg-slate-950 border border-cyan-500/30 rounded-xl max-w-md w-full p-6 space-y-6">
            <h3 className="text-xl text-white font-bold">No Awards Found</h3>
            <p className="text-slate-300">
              No awards exist for this tournament. Do you want to automatically
              create the default awards?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDefaultPrompt(false);
                  setAwards([]); // user chose NO
                }}
                className="px-4 py-2 bg-slate-800 text-slate-300 border border-slate-600 rounded-none"
              >
                No
              </button>
              <button
                onClick={async () => {
                  const defaults = Object.entries(PREDEFINED_AWARDS).map(
                    ([tag, def]) => ({
                      tournament_id: tournamentId,
                      player_id: null,
                      player_name: null,
                      award_name: def.label,
                      award_tag: tag,
                      icon_type: "predefined",
                      icon_url: null,
                      icon_data: def.icon_data,
                      awarded_by: user?.id,
                      awarded_at: new Date().toISOString(),
                    })
                  );
                  await supabase.from("tournament_awards").insert(defaults);
                  setAwards(defaults);
                  setShowDefaultPrompt(false);
                }}
                className="px-6 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-none"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
