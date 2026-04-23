import { useState, useEffect } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { X, Trash2, Plus } from "lucide-react";

interface Activity {
  id: number;
  title: string;
  date: string | null;
  time: string | null;
  description: string | null;
  image_url: string | null;
  release_at: number | null;
}

const emptyActivity = {
  title: "",
  date: "",
  time: "",
  description: "",
  image_url: "",
  release_at: "",
};

export default function AdminMatches() {
  // --- Threshold settings ---
  const [confirmThreshold, setConfirmThreshold] = useState("");
  const [rejectThreshold, setRejectThreshold] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // --- Activities ---
  const [activities, setActivities] = useState<Activity[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyActivity);
  const [activityMsg, setActivityMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then(
        (r) =>
          r.json() as Promise<{
            confirm_threshold: number;
            reject_threshold: number;
          }>,
      )
      .then((data) => {
        setConfirmThreshold(String(data.confirm_threshold));
        setRejectThreshold(String(data.reject_threshold));
      });

    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    const res = await fetch("/api/activities");
    if (res.ok) {
      const data = (await res.json()) as { activities: Activity[] };
      setActivities(data.activities);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirm_threshold: Number(confirmThreshold),
          reject_threshold: Number(rejectThreshold),
        }),
      });
      if (res.ok) {
        setMessage("Settings saved!");
      } else {
        const err = await res.json();
        setMessage((err as { error?: string }).error || "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyActivity);
    setActivityMsg("");
    setShowForm(true);
  };

  const epochToLocal = (epoch: number) => {
    const d = new Date(epoch);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openEdit = (a: Activity) => {
    setEditingId(a.id);
    setForm({
      title: a.title || "",
      date: a.date || "",
      time: a.time || "",
      description: a.description || "",
      image_url: a.image_url || "",
      release_at: a.release_at ? epochToLocal(a.release_at) : "",
    });
    setActivityMsg("");
    setShowForm(true);
  };

  const handleActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActivityMsg("");
    setSubmitting(true);

    const payload = {
      title: form.title,
      date: form.date || null,
      time: form.time || null,
      description: form.description || null,
      image_url: form.image_url || null,
      release_at: form.release_at ? new Date(form.release_at).getTime() : null,
    };

    try {
      const url = editingId
        ? `/api/activities/${editingId}`
        : "/api/activities";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowForm(false);
        await fetchActivities();
      } else {
        const err = await res.json().catch(() => null);
        setActivityMsg(
          (err as { error?: string } | null)?.error ||
            "Failed to save activity",
        );
      }
    } catch {
      setActivityMsg("Failed to save activity");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/activities/${id}`, { method: "DELETE" });
    setDeleteId(null);
    await fetchActivities();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white/90">Settings</h1>

      {/* Threshold settings */}
      <form onSubmit={handleSave}>
        <Card>
          <CardContent className="space-y-5">
            <h2 className="text-sm font-semibold text-white/70">
              Match Thresholds
            </h2>

            {message && (
              <div
                className={`text-sm p-3 rounded-xl ${
                  message.includes("saved")
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-red-500/15 text-red-400"
                }`}
              >
                {message}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">
                Confirm Threshold
              </label>
              <Input
                type="number"
                min="1"
                value={confirmThreshold}
                onChange={(e) => setConfirmThreshold(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/60 mb-1.5">
                Reject Threshold
              </label>
              <Input
                type="number"
                min="1"
                value={rejectThreshold}
                onChange={(e) => setRejectThreshold(e.target.value)}
                required
              />
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* Activities management */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white/70">Activities</h2>
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus size={14} />
            Add
          </Button>
        </div>

        {activities.length === 0 ? (
          <Card>
            <p className="text-sm text-white/30 text-center py-4">
              No activities yet
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {activities.map((a) => (
              <Card
                key={a.id}
                className="p-3 cursor-pointer hover:bg-white/[0.06] transition-colors"
                onClick={() => openEdit(a)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white/90 truncate">
                      {a.title}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">
                      {a.date || "No date"}
                      {a.time && ` · ${a.time}`}
                      {a.release_at && (
                        <span className="text-accent-light ml-2">
                          Release: {new Date(a.release_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(a.id);
                      }}
                      className="p-2 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Activity form modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="w-full max-w-sm max-h-[85vh] overflow-y-auto rounded-2xl border border-white/[0.1] bg-white/[0.06] backdrop-blur-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white/90">
                {editingId ? "Edit Activity" : "New Activity"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="text-white/30 hover:text-white/60 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleActivitySubmit} className="space-y-4">
              {activityMsg && (
                <div className="rounded-xl bg-red-500/15 text-red-400 text-sm p-3">
                  {activityMsg}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">
                  Title *
                </label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                  placeholder="Activity title"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1.5">
                    Date
                  </label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-1.5">
                    Time
                  </label>
                  <Input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">
                  Description (HTML)
                </label>
                <Textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  rows={4}
                  placeholder='<p>Details here...</p>'
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">
                  Image URL
                </label>
                <Input
                  type="url"
                  value={form.image_url}
                  onChange={(e) =>
                    setForm({ ...form, image_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white/60 mb-1.5">
                  Release Date & Time
                </label>
                <p className="text-xs text-white/30 mb-2">
                  Activity hidden until this time
                </p>
                <Input
                  type="datetime-local"
                  value={form.release_at}
                  onChange={(e) =>
                    setForm({ ...form, release_at: e.target.value })
                  }
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting
                  ? "Saving..."
                  : editingId
                    ? "Update Activity"
                    : "Create Activity"}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId !== null && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
          onClick={() => setDeleteId(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-white/[0.1] bg-white/[0.06] backdrop-blur-xl p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-white/90 mb-2">
              Delete Activity
            </h2>
            <p className="text-sm text-white/55 mb-6">
              Are you sure? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button
                className="flex-1"
                variant="secondary"
                onClick={() => setDeleteId(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                variant="danger"
                data-testid="confirm-delete"
                onClick={() => handleDelete(deleteId)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
