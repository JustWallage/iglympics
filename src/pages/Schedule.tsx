import { useCallback, useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Calendar, Clock, Lock } from "lucide-react";
import { useCachedFetch } from "../lib/useCachedFetch";

interface Activity {
  id: number;
  title: string | null;
  date: string | null;
  time: string | null;
  description: string | null;
  image_url: string | null;
  link_url: string | null;
  hint: string | null;
  release_at: number | null;
  released: boolean;
}

function Countdown({ target, onExpired }: { target: number; onExpired?: () => void }) {
  const [remaining, setRemaining] = useState(() => {
    const diff = target - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  });
  const expiredRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      const diff = target - Date.now();
      const secs = Math.max(0, Math.floor(diff / 1000));
      setRemaining(secs);
      if (secs <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        // Delay refetch slightly so the server's second-precision clock
        // has also passed the release_at threshold
        setTimeout(() => onExpired?.(), 1500);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [target, onExpired]);

  if (remaining <= 0) return null;

  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex gap-2 mt-2" data-testid="countdown">
      {days > 0 && (
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold text-white/70 tabular-nums">{days}</span>
          <span className="text-[10px] text-white/30 uppercase">days</span>
        </div>
      )}
      <div className="flex flex-col items-center">
        <span className="text-lg font-bold text-white/70 tabular-nums">{pad(hours)}</span>
        <span className="text-[10px] text-white/30 uppercase">hrs</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-lg font-bold text-white/70 tabular-nums">{pad(minutes)}</span>
        <span className="text-[10px] text-white/30 uppercase">min</span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-lg font-bold text-white/70 tabular-nums">{pad(seconds)}</span>
        <span className="text-[10px] text-white/30 uppercase">sec</span>
      </div>
    </div>
  );
}

export default function Schedule() {
  const { data, loading, mutate } = useCachedFetch<{ activities: Activity[] }>("/api/activities");
  const activities = data?.activities ?? [];
  const upcomingRef = useRef<HTMLDivElement>(null);

  const handleCountdownExpired = useCallback(() => {
    mutate();
  }, [mutate]);

  // Auto-scroll to upcoming section after activities load
  useEffect(() => {
    if (!loading && upcomingRef.current) {
      setTimeout(() => {
        upcomingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [loading, activities]);

  if (loading) {
    return (
      <div className="text-center py-12 text-white/35 text-sm">Loading...</div>
    );
  }

  const formatDate = (dateStr: string) =>
    new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const formatTime = (timeStr: string) => {
    const [h, m] = timeStr.split(":");
    const date = new Date();
    date.setHours(Number(h), Number(m));
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const now = new Date().toISOString().slice(0, 10);
  const pastActivities = activities.filter(
    (a) => a.released && a.date && a.date < now,
  );
  const upcomingActivities = activities.filter(
    (a) => !a.released || !a.date || a.date >= now,
  );

  const renderCard = (a: Activity) =>
    a.released ? (
      <Card key={a.id} className="overflow-hidden p-0">
        {a.image_url && (
          <img
            src={a.image_url}
            alt={a.title || "Activity"}
            className="w-full h-48 object-cover"
          />
        )}
        <div className="p-5">
          <h2 className="text-base font-semibold text-white/90 mb-2">
            {a.title}
          </h2>

          <div className="flex items-center gap-3 mb-3">
            {a.date && (
              <Badge variant="info" className="gap-1">
                <Calendar size={12} />
                {formatDate(a.date)}
              </Badge>
            )}
            {a.time && (
              <Badge variant="default" className="gap-1">
                <Clock size={12} />
                {formatTime(a.time)}
              </Badge>
            )}
          </div>

          {a.description && (
            <div
              className="text-sm text-white/60 leading-relaxed [&_a]:text-accent-light [&_a]:underline"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(a.description),
              }}
            />
          )}

          {a.link_url && (
            <a
              href={a.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 h-10 rounded-xl bg-accent/15 text-accent-light text-sm font-medium hover:bg-accent/25 transition-colors"
            >
              Open link
            </a>
          )}
        </div>
      </Card>
    ) : (
      <Card key={a.id} className="overflow-hidden p-0 relative">
        {a.image_url ? (
          <img
            src={a.image_url}
            alt="Upcoming activity"
            className="w-full h-48 object-cover blur-xl scale-110"
          />
        ) : (
          <div className="w-full h-48 bg-white/[0.04]" />
        )}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
          <Lock size={24} className="text-white/30" />
          {a.hint ? (
            <span className="text-sm font-medium text-white/60 px-4 text-center">{a.hint}</span>
          ) : (
            <span className="text-sm font-medium text-white/40">Coming soon</span>
          )}
          {a.release_at && <Countdown target={a.release_at} onExpired={handleCountdownExpired} />}
        </div>
      </Card>
    );

  return (
    <div>
      <h1 className="text-xl font-bold text-white/90 mb-4">Schedule</h1>

      {activities.length === 0 ? (
        <div className="text-center py-12 text-white/30 text-sm">
          No activities yet
        </div>
      ) : (
        <div className="space-y-4">
          {pastActivities.length > 0 && (
            <>
              {pastActivities.map(renderCard)}
            </>
          )}

          <div ref={upcomingRef} className="flex items-center gap-3 py-2">
            <div className="flex-1 h-px bg-white/[0.1]" />
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
              Upcoming activities
            </span>
            <div className="flex-1 h-px bg-white/[0.1]" />
          </div>

          {upcomingActivities.length > 0 ? (
            upcomingActivities.map(renderCard)
          ) : (
            <div className="text-center py-6 text-white/30 text-sm">
              No upcoming activities
            </div>
          )}
        </div>
      )}
    </div>
  );
}
