import { useState, useEffect } from "react";
import { Camera, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebSocketContext";
import { useCachedFetch } from "../lib/useCachedFetch";
import { Card } from "../components/ui/card";
import StoryViewer from "../components/Stories/StoryViewer";
import CreateStory from "../components/Stories/CreateStory";
import type { StoryGroup } from "../components/Stories/StoriesBar";

const BG_GRADIENTS: Record<string, string> = {
  violet: "from-violet-600 to-purple-900",
  sky: "from-sky-500 to-blue-900",
  rose: "from-rose-500 to-pink-900",
  amber: "from-amber-500 to-orange-900",
  emerald: "from-emerald-500 to-teal-900",
  fuchsia: "from-fuchsia-500 to-purple-900",
  orange: "from-orange-500 to-red-900",
  cyan: "from-cyan-500 to-blue-900",
};

export default function Snaps() {
  const { user, openLoginModal } = useAuth();
  const { subscribe } = useWebSocket();
  const { data, loading, mutate } = useCachedFetch<{
    story_groups: StoryGroup[];
  }>("/api/stories");
  const [viewingGroup, setViewingGroup] = useState<StoryGroup | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const groups = data?.story_groups ?? [];

  useEffect(() => {
    const unsub = subscribe("story_created", () => mutate());
    return unsub;
  }, [subscribe, mutate]);

  // Put current user first
  const sorted = [...groups].sort((a, b) => {
    if (user && a.user_id === user.id) return -1;
    if (user && b.user_id === user.id) return 1;
    return 0;
  });

  const handleAdd = () => {
    if (!user) {
      openLoginModal();
      return;
    }
    setShowCreate(true);
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-white/35 text-sm">Loading...</div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera size={18} className="text-yellow-400" />
          <h1 className="text-xl font-bold text-white/90">Snaps</h1>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent/15 text-accent-light text-sm font-medium hover:bg-accent/25 transition-colors"
        >
          <Plus size={14} />
          New Snap
        </button>
      </div>

      <p className="text-xs text-white/35">
        Ephemeral snaps that disappear after 24 hours ⏳
      </p>

      {groups.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <Camera size={32} className="mx-auto text-white/15 mb-3" />
            <p className="text-sm text-white/40 mb-4">
              No snaps yet — be the first to share!
            </p>
            <button
              onClick={handleAdd}
              className="px-4 py-2 rounded-xl bg-accent/15 text-accent-light text-sm font-medium hover:bg-accent/25 transition-colors"
            >
              Post a Snap
            </button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {sorted.map((group) => {
            const latestStory = group.stories[0];
            const gradient =
              BG_GRADIENTS[latestStory?.bg_color ?? "violet"] ??
              BG_GRADIENTS.violet;
            return (
              <button
                key={group.user_id}
                onClick={() => setViewingGroup(group)}
                className="relative aspect-[3/4] rounded-2xl overflow-hidden group"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${gradient}`}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                  {latestStory?.emoji && (
                    <span className="text-3xl mb-2">{latestStory.emoji}</span>
                  )}
                  <p className="text-sm font-bold text-white text-center line-clamp-3 drop-shadow-lg">
                    {latestStory?.content}
                  </p>
                </div>
                {/* User label */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold text-white">
                      {group.user_name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-white/90">
                      {user && group.user_id === user.id
                        ? "You"
                        : group.user_name}
                    </span>
                    <span className="ml-auto text-[10px] text-white/50">
                      {group.stories.length} snap
                      {group.stories.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                {/* Hover effect */}
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors" />
              </button>
            );
          })}
        </div>
      )}

      {viewingGroup && (
        <StoryViewer
          group={viewingGroup}
          onClose={() => setViewingGroup(null)}
        />
      )}

      {showCreate && (
        <CreateStory
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            mutate();
          }}
        />
      )}
    </div>
  );
}
