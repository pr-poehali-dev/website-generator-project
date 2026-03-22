import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

const API = {
  characters: "https://functions.poehali.dev/f9ac5731-8a63-45d0-9f59-9cf38f368cba",
  chat: "https://functions.poehali.dev/73cc788d-177f-40b4-9416-e935f4b8f65c",
  history: "https://functions.poehali.dev/ff9f3482-ca76-4699-97ba-73f43177f7ac",
};

const EMOJIS = ["🤖", "🧙", "🦊", "🐉", "👸", "🕵️", "🧛", "🦸", "🧜", "🎭", "👾", "🦁", "🐺", "🧝", "🧞", "🧚"];

type Tab = "characters" | "chat" | "create" | "history" | "settings";

interface Character {
  id: number;
  name: string;
  description: string;
  avatar_emoji: string;
  is_public: boolean;
  created_at: string;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  char_name?: string;
  avatar_emoji?: string;
}

export default function Index() {
  const [tab, setTab] = useState<Tab>("characters");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeChar, setActiveChar] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyAll, setHistoryAll] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newEmoji, setNewEmoji] = useState("🤖");
  const [newIsPublic, setNewIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  const [settings, setSettings] = useState({
    model: localStorage.getItem("ai_model") || "gpt-3.5-turbo",
    temperature: localStorage.getItem("ai_temp") || "0.8",
  });
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadCharacters(); }, []);
  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab]);
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function loadCharacters() {
    const res = await fetch(API.characters);
    const data = await res.json();
    setCharacters(data);
  }

  async function loadHistory(search = "") {
    const url = search ? `${API.history}?search=${encodeURIComponent(search)}` : API.history;
    const res = await fetch(url);
    const data = await res.json();
    setHistoryAll(data);
  }

  async function selectCharacter(char: Character) {
    setActiveChar(char);
    setTab("chat");
    setSidebarOpen(false);
    const res = await fetch(`${API.history}?char_id=${char.id}`);
    const data = await res.json();
    setMessages(data);
  }

  async function sendMessage() {
    if (!input.trim() || !activeChar || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { id: Date.now(), role: "user", content: userMsg, created_at: "" }]);
    setLoading(true);
    try {
      const res = await fetch(API.chat, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ char_id: activeChar.id, message: userMsg, model: settings.model, temperature: parseFloat(settings.temperature) }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages(prev => [...prev, { id: Date.now() + 1, role: "assistant", content: data.reply, created_at: "" }]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function createCharacter() {
    if (!newName.trim() || !newDesc.trim()) return;
    setCreating(true);
    await fetch(API.characters, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, description: newDesc, avatar_emoji: newEmoji, is_public: newIsPublic }),
    });
    setCreating(false);
    setNewName(""); setNewDesc(""); setNewEmoji("🤖"); setNewIsPublic(true);
    await loadCharacters();
    setTab("characters");
  }

  async function deleteCharacter(id: number) {
    await fetch(`${API.characters}?id=${id}`, { method: "DELETE" });
    await loadCharacters();
    if (activeChar?.id === id) { setActiveChar(null); setMessages([]); }
  }

  async function togglePublic(char: Character) {
    setCharacters(prev => prev.map(c => c.id === char.id ? { ...c, is_public: !c.is_public } : c));
    await fetch(API.characters, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: char.id, is_public: !char.is_public }),
    });
  }

  function saveSettings() {
    localStorage.setItem("ai_model", settings.model);
    localStorage.setItem("ai_temp", settings.temperature);
  }

  const navItems: { id: Tab; icon: string; label: string }[] = [
    { id: "characters", icon: "Users", label: "Персонажи" },
    { id: "chat", icon: "MessageCircle", label: "Чат" },
    { id: "create", icon: "PlusCircle", label: "Создать" },
    { id: "history", icon: "Clock", label: "История" },
    { id: "settings", icon: "Settings2", label: "Настройки" },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#1a1a1f", fontFamily: "'Golos Text', sans-serif", color: "#e8e8ec" }}>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50 w-72 h-full flex flex-col animate-slide-in" style={{ background: "#111116" }}>
            <div className="px-5 py-5 border-b" style={{ borderColor: "#2a2a33" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xl font-bold tracking-tight">My<span style={{ color: "#a78bfa" }}>.AI</span></span>
                <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-xl" style={{ color: "#666" }}>
                  <Icon name="X" size={18} />
                </button>
              </div>
              <p className="text-xs" style={{ color: "#444" }}>Чат с ИИ-персонажами</p>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setTab(item.id); setSidebarOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all"
                  style={{ background: tab === item.id ? "#2a2a38" : "transparent", color: tab === item.id ? "#a78bfa" : "#666" }}
                >
                  <Icon name={item.icon} size={18} />
                  {item.label}
                </button>
              ))}

              {characters.length > 0 && (
                <>
                  <div className="px-4 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "#333" }}>
                    Персонажи
                  </div>
                  {characters.slice(0, 6).map(char => (
                    <button
                      key={char.id}
                      onClick={() => selectCharacter(char)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm transition-all"
                      style={{ background: activeChar?.id === char.id ? "#2a2a38" : "transparent", color: activeChar?.id === char.id ? "#e8e8ec" : "#666" }}
                    >
                      <span className="text-lg">{char.avatar_emoji}</span>
                      <span className="truncate">{char.name}</span>
                      {!char.is_public && <Icon name="Lock" size={12} className="ml-auto shrink-0" style={{ color: "#444" }} />}
                    </button>
                  ))}
                </>
              )}
            </nav>

            <div className="px-5 py-4 border-t text-xs" style={{ borderColor: "#2a2a33", color: "#333" }}>
              My.AI — ИИ-персонажи
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b" style={{ background: "#111116", borderColor: "#222228" }}>
        <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl" style={{ color: "#666" }}>
          <Icon name="Menu" size={22} />
        </button>
        <span className="text-lg font-bold tracking-tight">My<span style={{ color: "#a78bfa" }}>.AI</span></span>
        {activeChar && tab === "chat" && (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span>{activeChar.avatar_emoji}</span>
            <span className="font-medium" style={{ color: "#ccc" }}>{activeChar.name}</span>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 overflow-hidden flex flex-col max-w-2xl w-full mx-auto">

        {/* CHARACTERS */}
        {tab === "characters" && (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-5">
              <h1 className="text-2xl font-bold mb-1">Персонажи</h1>
              <p className="text-sm" style={{ color: "#555" }}>Выберите с кем поговорить</p>
            </div>
            {characters.length === 0 ? (
              <div className="text-center py-20 animate-fade-in">
                <div className="text-5xl mb-4">🤖</div>
                <p className="mb-5" style={{ color: "#555" }}>Персонажей пока нет</p>
                <button onClick={() => setTab("create")} className="px-6 py-2.5 rounded-2xl text-sm font-semibold" style={{ background: "#a78bfa", color: "#fff" }}>
                  Создать первого
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {characters.map((char, i) => (
                  <div
                    key={char.id}
                    className="group flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all animate-fade-in"
                    style={{ borderColor: "#2a2a33", background: "#16161c", animationDelay: `${i * 0.04}s` }}
                    onClick={() => selectCharacter(char)}
                  >
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0" style={{ background: "#222230" }}>
                      {char.avatar_emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold" style={{ color: "#e8e8ec" }}>{char.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: char.is_public ? "#1a2e1a" : "#2a1a2a", color: char.is_public ? "#4ade80" : "#c084fc" }}>
                          {char.is_public ? "Публичный" : "Приватный"}
                        </span>
                      </div>
                      <p className="text-sm truncate mt-0.5" style={{ color: "#555" }}>{char.description}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={e => { e.stopPropagation(); togglePublic(char); }}
                        className="p-2 rounded-xl"
                        style={{ color: "#555" }}
                        title={char.is_public ? "Сделать приватным" : "Сделать публичным"}
                      >
                        <Icon name={char.is_public ? "Globe" : "Lock"} size={15} />
                      </button>
                      <button onClick={e => { e.stopPropagation(); deleteCharacter(char.id); }} className="p-2 rounded-xl" style={{ color: "#555" }}>
                        <Icon name="Trash2" size={15} />
                      </button>
                    </div>
                    <Icon name="ChevronRight" size={16} style={{ color: "#333" }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CHAT */}
        {tab === "chat" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {!activeChar ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center animate-fade-in">
                  <div className="text-5xl mb-4">💬</div>
                  <p className="mb-5" style={{ color: "#555" }}>Выберите персонажа для разговора</p>
                  <button onClick={() => setTab("characters")} className="px-6 py-2.5 rounded-2xl text-sm font-semibold" style={{ background: "#a78bfa", color: "#fff" }}>
                    К персонажам
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {messages.length === 0 && (
                    <div className="text-center py-12 animate-fade-in">
                      <div className="text-5xl mb-3">{activeChar.avatar_emoji}</div>
                      <p className="font-semibold mb-1" style={{ color: "#ccc" }}>{activeChar.name}</p>
                      <p className="text-sm" style={{ color: "#555" }}>Начните разговор</p>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div key={msg.id} className={`flex animate-msg-in ${msg.role === "user" ? "justify-end" : "justify-start"}`} style={{ animationDelay: `${i * 0.02}s` }}>
                      {msg.role === "assistant" && (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-base mr-2 shrink-0 self-end" style={{ background: "#222230" }}>
                          {activeChar.avatar_emoji}
                        </div>
                      )}
                      <div
                        className="max-w-xs md:max-w-sm px-4 py-3 rounded-2xl text-sm leading-relaxed"
                        style={msg.role === "user"
                          ? { background: "#a78bfa", color: "#fff", borderBottomRightRadius: "4px" }
                          : { background: "#222230", color: "#ddd", borderBottomLeftRadius: "4px" }
                        }
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start animate-fade-in">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-base mr-2 shrink-0" style={{ background: "#222230" }}>
                        {activeChar.avatar_emoji}
                      </div>
                      <div className="px-4 py-3 rounded-2xl" style={{ background: "#222230", borderBottomLeftRadius: "4px" }}>
                        <div className="flex gap-1">
                          {[0, 1, 2].map(j => (
                            <div key={j} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#555", animationDelay: `${j * 0.15}s` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t" style={{ borderColor: "#222228" }}>
                  <div className="flex gap-2">
                    <input
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      placeholder={`Напишите ${activeChar.name}...`}
                      className="flex-1 px-4 py-3 rounded-2xl text-sm outline-none placeholder-neutral-600"
                      style={{ background: "#222230", color: "#e8e8ec", border: "1px solid #2a2a38" }}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={loading || !input.trim()}
                      className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all shrink-0 disabled:opacity-30"
                      style={{ background: "#a78bfa", color: "#fff" }}
                    >
                      <Icon name="Send" size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* CREATE */}
        {tab === "create" && (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-1">Новый персонаж</h1>
              <p className="text-sm" style={{ color: "#555" }}>Опишите характер и роль</p>
            </div>
            <div className="space-y-5 animate-fade-in">
              <div>
                <label className="text-sm font-medium block mb-2" style={{ color: "#888" }}>Аватар</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map(e => (
                    <button
                      key={e}
                      onClick={() => setNewEmoji(e)}
                      className="w-11 h-11 rounded-2xl text-xl flex items-center justify-center transition-all"
                      style={{ background: newEmoji === e ? "#a78bfa" : "#222230", transform: newEmoji === e ? "scale(1.1)" : "scale(1)" }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-2" style={{ color: "#888" }}>Имя персонажа</label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Например: Мудрый волшебник"
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none placeholder-neutral-600"
                  style={{ background: "#222230", color: "#e8e8ec", border: "1px solid #2a2a38" }}
                />
              </div>
              <div>
                <label className="text-sm font-medium block mb-2" style={{ color: "#888" }}>Описание и характер</label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Опишите кто это, как говорит, что знает..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none placeholder-neutral-600 resize-none"
                  style={{ background: "#222230", color: "#e8e8ec", border: "1px solid #2a2a38" }}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-2xl" style={{ background: "#16161c", border: "1px solid #2a2a33" }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "#ccc" }}>{newIsPublic ? "Публичный" : "Приватный"}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#444" }}>{newIsPublic ? "Виден всем пользователям" : "Виден только вам"}</p>
                </div>
                <button
                  onClick={() => setNewIsPublic(!newIsPublic)}
                  className="w-12 h-6 rounded-full transition-all relative shrink-0"
                  style={{ background: newIsPublic ? "#a78bfa" : "#2a2a38" }}
                >
                  <div
                    className="absolute top-0.5 w-5 h-5 rounded-full transition-all"
                    style={{ background: "#fff", left: newIsPublic ? "calc(100% - 22px)" : "2px" }}
                  />
                </button>
              </div>
              <button
                onClick={createCharacter}
                disabled={creating || !newName.trim() || !newDesc.trim()}
                className="w-full py-3 rounded-2xl text-sm font-semibold transition-all disabled:opacity-40"
                style={{ background: "#a78bfa", color: "#fff" }}
              >
                {creating ? "Создаю..." : "Создать персонажа"}
              </button>
            </div>
          </div>
        )}

        {/* HISTORY */}
        {tab === "history" && (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-5">
              <h1 className="text-2xl font-bold mb-3">История</h1>
              <div className="relative">
                <Icon name="Search" size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "#555" }} />
                <input
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); loadHistory(e.target.value); }}
                  placeholder="Поиск по диалогам..."
                  className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm outline-none placeholder-neutral-600"
                  style={{ background: "#222230", color: "#e8e8ec", border: "1px solid #2a2a38" }}
                />
              </div>
            </div>
            {historyAll.length === 0 ? (
              <div className="text-center py-16 animate-fade-in">
                <div className="text-4xl mb-3">📭</div>
                <p style={{ color: "#555" }}>{searchQuery ? "Ничего не найдено" : "История пуста"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {historyAll.map((msg, i) => (
                  <div
                    key={msg.id}
                    className="flex gap-3 p-3 rounded-2xl animate-fade-in"
                    style={{ background: msg.role === "user" ? "#16161c" : "#1a1a24", animationDelay: `${i * 0.03}s` }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0" style={{ background: "#222230" }}>
                      {msg.role === "user" ? "👤" : msg.avatar_emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold" style={{ color: "#777" }}>{msg.role === "user" ? "Вы" : msg.char_name}</span>
                        <span className="text-xs" style={{ color: "#333" }}>{msg.created_at?.slice(0, 10)}</span>
                      </div>
                      <p className="text-sm line-clamp-2" style={{ color: "#bbb" }}>{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SETTINGS */}
        {tab === "settings" && (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-1">Настройки</h1>
              <p className="text-sm" style={{ color: "#555" }}>Параметры модели ИИ</p>
            </div>
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl flex gap-3" style={{ background: "#1e1a10", border: "1px solid #3a3010" }}>
                <Icon name="KeyRound" size={18} className="shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#fbbf24" }}>API ключ OpenAI</p>
                  <p className="text-xs mt-0.5" style={{ color: "#856c30" }}>Настраивается в разделе «Ядро → Секреты» как OPENAI_API_KEY</p>
                </div>
              </div>
              <div className="p-4 rounded-2xl" style={{ background: "#16161c", border: "1px solid #2a2a33" }}>
                <label className="text-sm font-medium block mb-2" style={{ color: "#888" }}>Модель GPT</label>
                <select
                  value={settings.model}
                  onChange={e => setSettings(s => ({ ...s, model: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: "#222230", color: "#e8e8ec", border: "1px solid #2a2a38" }}
                >
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (быстрый)</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o (умный)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                </select>
              </div>
              <div className="p-4 rounded-2xl" style={{ background: "#16161c", border: "1px solid #2a2a33" }}>
                <label className="text-sm font-medium block mb-3" style={{ color: "#888" }}>
                  Креативность: <span className="font-bold" style={{ color: "#a78bfa" }}>{settings.temperature}</span>
                </label>
                <input
                  type="range" min="0" max="2" step="0.1"
                  value={settings.temperature}
                  onChange={e => setSettings(s => ({ ...s, temperature: e.target.value }))}
                  className="w-full"
                  style={{ accentColor: "#a78bfa" }}
                />
                <div className="flex justify-between text-xs mt-1" style={{ color: "#444" }}>
                  <span>Точный</span><span>Творческий</span>
                </div>
              </div>
              <button
                onClick={saveSettings}
                className="w-full py-3 rounded-2xl text-sm font-semibold"
                style={{ background: "#a78bfa", color: "#fff" }}
              >
                Сохранить настройки
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="border-t" style={{ background: "#111116", borderColor: "#222228" }}>
        <div className="max-w-2xl mx-auto flex justify-around px-2 py-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-all"
              style={{ color: tab === item.id ? "#a78bfa" : "#444" }}
            >
              <div className="p-1.5 rounded-xl" style={{ background: tab === item.id ? "#1e1a2e" : "transparent" }}>
                <Icon name={item.icon} size={20} />
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
