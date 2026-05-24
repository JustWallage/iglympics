import { useState, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";
import type { StoryGroup } from "./StoriesBar";

interface Props {
  groups: StoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
}

export default function StoryViewer({ groups, initialGroupIndex, onClose }: Props) {
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const group = groups[groupIndex];
  const story = group?.stories[index];
  const isVideo = story?.media_type === "video";

  const goNext = useCallback(() => {
    if (!group) return;
    if (index < group.stories.length - 1) {
      setIndex((i) => i + 1);
      setProgress(0);
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1);
      setIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [index, group?.stories.length, groupIndex, groups.length, onClose]);

  const goPrev = useCallback(() => {
    if (index > 0) {
      setIndex((i) => i - 1);
      setProgress(0);
    } else if (groupIndex > 0) {
      setGroupIndex((g) => g - 1);
      setIndex(groups[groupIndex - 1].stories.length - 1);
      setProgress(0);
    }
  }, [index, groupIndex, groups]);

  // Auto-advance for images (5 seconds); for videos, driven by the video element
  useEffect(() => {
    setProgress(0);
    if (isVideo) return;
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          goNext();
          return 0;
        }
        return p + 2; // 50 ticks × 100ms = 5s
      });
    }, 100);
    return () => clearInterval(interval);
  }, [index, isVideo, goNext]);

  // Progress tracking for video stories
  useEffect(() => {
    if (!isVideo) return;
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };
    const onEnded = () => goNext();

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
    };
  }, [isVideo, index, goNext]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onClose]);

  if (!story) return null;

  const mediaUrl = `/api/stories/image/${story.image_key}`;
  const timeAgo = getTimeAgo(story.created_at);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      {/* Progress bars */}
      <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-10">
        {group.stories.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-0.5 rounded-full bg-white/20 overflow-hidden"
          >
            <div
              className="h-full bg-white/80 rounded-full transition-all duration-100"
              style={{
                width:
                  i < index ? "100%" : i === index ? `${progress}%` : "0%",
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-2 mt-1">
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white">
            {group.user_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="text-sm font-semibold text-white drop-shadow-lg">
              {group.user_name}
            </span>
            <span className="text-xs text-white/60 ml-2 drop-shadow-lg">
              {timeAgo}
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full bg-black/30 text-white/70 hover:bg-black/50 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Story media */}
      {isVideo ? (
        <video
          ref={videoRef}
          key={story.id}
          src={mediaUrl}
          className="w-full h-full object-contain"
          autoPlay
          playsInline
        />
      ) : (
        <img
          src={mediaUrl}
          alt="Story"
          className="w-full h-full object-contain"
        />
      )}

      {/* Caption overlay */}
      {story.caption && (
        <div className="absolute bottom-16 left-0 right-0 px-6 z-10">
          <div className="bg-black/50 backdrop-blur-sm rounded-2xl px-4 py-3">
            <p className="text-sm text-white text-center font-medium">
              {story.caption}
            </p>
          </div>
        </div>
      )}

      {/* Tap zones */}
      <button
        onClick={goPrev}
        className="absolute left-0 top-16 bottom-0 w-1/3 z-10"
        aria-label="Previous story"
      />
      <button
        onClick={goNext}
        className="absolute right-0 top-16 bottom-0 w-2/3 z-10"
        aria-label="Next story"
      />
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = Date.now();
  const created = new Date(dateStr + "Z").getTime();
  const diffMs = now - created;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.floor(diffH / 24)}d ago`;
}
