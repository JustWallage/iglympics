import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCachedFetch } from "../../lib/useCachedFetch";
import StoryViewer from "./StoryViewer";
import CreateStory from "./CreateStory";

interface Story {
  id: number;
  content: string;
  bg_color: string;
  emoji: string | null;
  created_at: string;
  expires_at: string;
}

export interface StoryGroup {
  user_id: number;
  user_name: string;
  stories: Story[];
}

const BG_RING_COLORS: Record<string, string> = {
  violet: "ring-violet-400",
  sky: "ring-sky-400",
  rose: "ring-rose-400",
  amber: "ring-amber-400",
  emerald: "ring-emerald-400",
  fuchsia: "ring-fuchsia-400",
  orange: "ring-orange-400",
  cyan: "ring-cyan-400",
};

export default function StoriesBar() {
  const { user, openLoginModal } = useAuth();
  const navigate = useNavigate();
  const { data, mutate } = useCachedFetch<{ story_groups: StoryGroup[] }>(
    "/api/stories",
  );
  const [viewingGroup, setViewingGroup] = useState<StoryGroup | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const groups = data?.story_groups ?? [];

  // Put current user's stories first
  const sorted = [...groups].sort((a, b) => {
    if (user && a.user_id === user.id) return -1;
    if (user && b.user_id === user.id) return 1;
    return 0;
  });

  const handleAddClick = () => {
    if (!user) {
      openLoginModal();
      return;
    }
    setShowCreate(true);
  };

  const handleCreated = () => {
    setShowCreate(false);
    mutate();
  };

  return (
    <>
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
        {/* Add story button */}
        <button
          onClick={handleAddClick}
          className="flex flex-col items-center gap-1.5 shrink-0"
        >
          <div className="relative h-14 w-14 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
            <Plus size={20} className="text-accent-light" />
          </div>
          <span className="text-[10px] text-white/40 font-medium">
            Add Snap
          </span>
        </button>

        {/* User story circles */}
        {sorted.map((group) => {
          const ringColor =
            BG_RING_COLORS[group.stories[0]?.bg_color ?? "violet"] ??
            "ring-violet-400";
          const initial = group.user_name.charAt(0).toUpperCase();
          return (
            <button
              key={group.user_id}
              onClick={() => setViewingGroup(group)}
              className="flex flex-col items-center gap-1.5 shrink-0"
            >
              <div
                className={`h-14 w-14 rounded-full ring-2 ${ringColor} bg-white/[0.08] flex items-center justify-center text-lg font-bold text-white/70`}
              >
                {group.stories[0]?.emoji ?? initial}
              </div>
              <span className="text-[10px] text-white/50 font-medium max-w-[56px] truncate">
                {user && group.user_id === user.id ? "You" : group.user_name}
              </span>
            </button>
          );
        })}

        {groups.length === 0 && (
          <button
            onClick={() => navigate("/snaps")}
            className="text-xs text-white/25 py-4 pl-2"
          >
            No snaps yet — be the first!
          </button>
        )}
      </div>

      {/* Viewer overlay */}
      {viewingGroup && (
        <StoryViewer
          group={viewingGroup}
          onClose={() => setViewingGroup(null)}
        />
      )}

      {/* Create overlay */}
      {showCreate && (
        <CreateStory
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
