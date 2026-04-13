import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebSocketContext";
import { useMusicPlayer } from "../context/MusicContext";
import { Send } from "lucide-react";

interface Message {
  id: number;
  content: string;
  created_at: string;
  user_id: number;
  user_name: string;
}

export default function Chat() {
  const { user } = useAuth();
  const music = useMusicPlayer();
  const hasMiniPlayer = music.songs.length > 0;
  const { subscribe } = useWebSocket();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch("/api/messages?limit=50");
      if (res.ok) {
        const data = (await res.json()) as { messages: Message[] };
        setMessages(data.messages);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (shouldAutoScroll.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  // Track scroll position to decide auto-scroll
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    shouldAutoScroll.current = atBottom;
  };

  // Real-time messages via WebSocket
  useEffect(() => {
    const unsub = subscribe("chat_message", (data: unknown) => {
      const msg = data as Message;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    return unsub;
  }, [subscribe]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;

    setSending(true);
    setInput("");
    shouldAutoScroll.current = true;

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const data = (await res.json()) as { message: Message };
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
      }
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });

  // Group messages by date
  const groupedMessages: { date: string; messages: Message[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const date = msg.created_at.split(" ")[0] || msg.created_at.split("T")[0];
    if (date !== currentDate) {
      currentDate = date;
      groupedMessages.push({ date: msg.created_at, messages: [msg] });
    } else {
      groupedMessages[groupedMessages.length - 1].messages.push(msg);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12 text-white/35 text-sm">Loading...</div>
    );
  }

  return (
    <div className="flex flex-col -mx-4 -mb-4" style={{ height: `calc(100dvh - 1.5rem - 5rem${hasMiniPlayer ? " - 3rem" : ""})` }}>
      {/* Messages area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 pt-2 pb-2 space-y-1 min-h-0"
      >
        {messages.length === 0 ? (
          <div className="text-center py-12 text-white/30 text-sm">
            No messages yet. Start the conversation!
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.date}>
              <div className="flex justify-center my-3">
                <span className="text-[10px] text-white/30 bg-white/[0.04] rounded-full px-3 py-1">
                  {formatDate(group.date)}
                </span>
              </div>
              {group.messages.map((msg, i) => {
                const isMe = msg.user_id === user?.id;
                const prevMsg = i > 0 ? group.messages[i - 1] : null;
                const showName = !prevMsg || prevMsg.user_id !== msg.user_id;

                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"} ${showName ? "mt-2" : "mt-0.5"}`}
                  >
                    <div className={`max-w-[80%] ${isMe ? "items-end" : "items-start"}`}>
                      {showName && !isMe && (
                        <div className="text-[11px] text-accent-light font-medium mb-0.5 px-1">
                          {msg.user_name}
                        </div>
                      )}
                      <div
                        className={`rounded-2xl px-3.5 py-2 text-sm break-words ${
                          isMe
                            ? "bg-accent/80 text-white rounded-br-md"
                            : "bg-white/[0.06] text-white/90 rounded-bl-md"
                        }`}
                      >
                        {msg.content}
                        <span
                          className={`text-[10px] ml-2 inline-block align-bottom ${
                            isMe ? "text-white/50" : "text-white/30"
                          }`}
                        >
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {user ? (
        <form
          onSubmit={handleSend}
          className="px-4 py-3 border-t border-white/[0.06]"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message..."
              maxLength={1000}
              className="flex-1 h-11 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 text-sm text-white/90 placeholder:text-white/30 outline-none transition-all focus:border-accent/50 focus:ring-1 focus:ring-accent/30 backdrop-blur-sm"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="h-11 w-11 rounded-xl bg-accent text-white flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 disabled:active:scale-100 shadow-[0_0_16px_var(--color-accent-glow)]"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      ) : (
        <div className="px-4 py-3 border-t border-white/[0.06] text-center text-sm text-white/30">
          Log in to send messages
        </div>
      )}
    </div>
  );
}
