import { useState, useEffect } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export default function AdminMatches() {
  const [confirmThreshold, setConfirmThreshold] = useState("");
  const [rejectThreshold, setRejectThreshold] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json() as Promise<{ confirm_threshold: number; reject_threshold: number }>)
      .then((data) => {
        setConfirmThreshold(String(data.confirm_threshold));
        setRejectThreshold(String(data.reject_threshold));
      });
  }, []);

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

  return (
    <div>
      <h1 className="text-xl font-bold text-white/90 mb-4">Settings</h1>
      <form onSubmit={handleSave}>
        <Card>
          <CardContent className="space-y-5">
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
              <p className="text-xs text-white/30 mb-2">
                Number of confirm votes needed to count a match
              </p>
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
              <p className="text-xs text-white/30 mb-2">
                Number of reject votes needed to discard a match
              </p>
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
    </div>
  );
}
