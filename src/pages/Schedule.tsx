import { useEffect, useState, useCallback } from "react";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Calendar, Clock, Lock } from "lucide-react";

interface Activity {
  id: number;
  title: string | null;
  date: string | null;
  time: string | null;
  description: string | null;
  image_url: string | null;
  release_at: string | null;
  released: boolean;
}

export default function Schedule() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch("/api/activities");
      if (res.ok) {
        const data = (await res.json()) as { activities: Activity[] };
        setActivities(data.activities);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

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

  return (
    <div>
      <h1 className="text-xl font-bold text-white/90 mb-4">Schedule</h1>

      {activities.length === 0 ? (
        <div className="text-center py-12 text-white/30 text-sm">
          No activities yet
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map((a) =>
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
                      dangerouslySetInnerHTML={{ __html: a.description }}
                    />
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
                  <span className="text-sm font-medium text-white/40">
                    Coming soon
                  </span>
                </div>
              </Card>
            ),
          )}
        </div>
      )}
    </div>
  );
}
