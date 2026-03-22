import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

const API = {
  characters: "https://functions.poehali.dev/f9ac5731-8a63-45d0-9f59-9cf38f368cba",
  chat: "https://functions.poehali.dev/73cc788d-177f-40b4-9416-e935f4b8f65c",
  history: "https://functions.poehali.dev/ff9f3482-ca76-4699-97ba-73f43177f7ac",
  profile: "https://functions.poehali.dev/f3cc98c6-56eb-4624-bfd4-70c1822ddc69",
  upload: "https://functions.poehali.dev/d5330b00-e830-495a-aa41-967c4dfdbbf5",
};

// Генерируем постоянный user_id для этого браузера
function getUserId(): string {
  let id = localStorage.getItem("my_ai_user_id");
  if (!id) {
    id = "u_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("my_ai_user_id", id);
  }
  return id;
}

const EMOJIS = ["🤖", "🧙", "🦊", "🐉", "👸", "🕵️", "🧛", "🦸", "🧜", "🎭", "👾", "🦁", "🐺", "🧝", "🧞", "🧚"];

type Tab = "characters" | "chat" | "create" | "history" | "settings" | "profile" | "mine";

interface Character {
  id: number;
  name: string;
  description: string;
  avatar_emoji: string;
  avatar_url?: string | null;
  is_public: boolean;
  owner_id?: string | null;
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

interface UserProfile {
  id: string;
  nickname: string;
  avatar_url?: string | null;
}

// Компонент аватарки с иконкой-заглушкой
function Avatar({ url, emoji, size = 40, className = "" }: { url?: string | null; emoji?: string; size?: number; className?: string }) {
  if (url) return <img src={url} alt="avatar" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} className={className} />;
  if (emoji) return <span style={{ fontSize: size * 0.55, lineHeight: 1 }}>{emoji}</span>;
  return <Icon name="User" size={size * 0.55} />;
}

export default function Index() {
  const userId = getUserId();
  const [tab, setTab] = useState<Tab>("characters");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [myChars, setMyChars] = useState<Character[]>([]);
  const [activeChar, setActiveChar] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyAll, setHistoryAll] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Create form
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newEmoji, setNewEmoji] = useState("🤖");
  const [newIsPublic, setNewIsPublic] = useState(true);
  const [newCharImg, setNewCharImg] = useState<string | null>(null);
  const [newCharImgType, setNewCharImgType] = useState("image/jpeg");
  const [creating, setCreating] = useState(false);

  // Profile
  const [profile, setProfile] = useState<UserProfile>({ id: userId, nickname: "Пользователь", avatar_url: null });
  const [editNick, setEditNick] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Settings
  const [settings, setSettings] = useState({
    model: localStorage.getItem("ai_model") || "openai/gpt-3.5-turbo",
    temperature: localStorage.getItem("ai_temp") || "0.8",
  });

  const chatRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const charImgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadCharacters(); loadProfile(); }, []);
  useEffect(() => { if (tab === "history") loadHistory(); }, [tab]);
  useEffect(() => { if (tab === "mine") loadMyChars(); }, [tab]);
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  async function loadCharacters() {
    const res = await fetch(`${API.characters}?user_id=${userId}`);
    const data = await res.json();
    setCharacters(Array.isArray(data) ? data : []);
  }

  async function loadMyChars() {
    const res = await fetch(`${API.characters}?user_id=${userId}&mine=1`);
    const data = await res.json();
    setMyChars(Array.isArray(data) ? data : []);
  }

  async function loadProfile() {
    const res = await fetch(`${API.profile}?user_id=${userId}`);
    const data = await res.json();
    setProfile(data);
    setEditNick(data.nickname);
  }

  async function loadHistory(search = "") {
    const url = search ? `${API.history}?search=${encodeURIComponent(search)}` : API.history;
    const res = await fetch(url);
    const data = await res.json();
    setHistoryAll(Array.isArray(data) ? data : []);
  }

  async function selectCharacter(char: Character) {
    setActiveChar(char);
    setTab("chat");
    setSidebarOpen(false);
    const res = await fetch(`${API.history}?char_id=${char.id}`);
    const data = await res.json();
    setMessages(Array.isArray(data) ? data : []);
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
        body: JSON.stringify({
          char_id: activeChar.id,
          message: userMsg,
          user_id: userId,
          model: settings.model,
          temperature: parseFloat(settings.temperature),
        }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages(prev => [...prev, { id: Date.now() + 1, role: "assistant", content: `⚠️ ${data.error}`, created_at: "" }]);
      } else if (data.reply) {
        setMessages(prev => [...prev, { id: Date.now() + 1, role: "assistant", content: data.reply, created_at: "" }]);
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: "assistant", content: "⚠️ Ошибка соединения", created_at: "" }]);
    } finally {
      setLoading(false);
    }
  }

  // Загрузка аватарки (user или character)
  function fileToBase64(file: File): Promise<string> {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.readAsDataURL(file);
    });
  }

  async function uploadAvatar(file: File, target: "user" | "character", targetId: string) {
    const b64 = await fileToBase64(file);
    const res = await fetch(API.upload, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: b64, target, target_id: targetId, content_type: file.type }),
    });
    const data = await res.json();
    return data.url as string;
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSavingProfile(true);
    const url = await uploadAvatar(file, "user", userId);
    setProfile(p => ({ ...p, avatar_url: url }));
    setSavingProfile(false);
  }

  async function handleCharImgChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await fileToBase64(file);
    setNewCharImg(b64);
    setNewCharImgType(file.type);
  }

  async function saveProfile() {
    setSavingProfile(true);
    await fetch(API.profile, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, nickname: editNick }),
    });
    setProfile(p => ({ ...p, nickname: editNick }));
    setSavingProfile(false);
  }

  async function createCharacter() {
    if (!newName.trim() || !newDesc.trim()) return;
    setCreating(true);
    const res = await fetch(API.characters, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, description: newDesc, avatar_emoji: newEmoji, is_public: newIsPublic, owner_id: userId }),
    });
    const data = await res.json();
    // Если есть фото — загрузим его
    if (newCharImg && data.char_id) {
      const b64 = newCharImg;
      await fetch(API.upload, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: b64, target: "character", target_id: String(data.char_id), content_type: newCharImgType }),
      });
    }
    setCreating(false);
    setNewName(""); setNewDesc(""); setNewEmoji("🤖"); setNewIsPublic(true); setNewCharImg(null);
    await loadCharacters();
    setTab("characters");
  }

  async function deleteCharacter(id: number) {
    await fetch(`${API.characters}?id=${id}&user_id=${userId}`, { method: "DELETE" });
    await loadCharacters();
    await loadMyChars();
    if (activeChar?.id === id) { setActiveChar(null); setMessages([]); }
  }

  async function togglePublic(char: Character) {
    const next = !char.is_public;
    setCharacters(prev => prev.map(c => c.id === char.id ? { ...c, is_public: next } : c));
    setMyChars(prev => prev.map(c => c.id === char.id ? { ...c, is_public: next } : c));
    await fetch(API.characters, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: char.id, is_public: next }),
    });
  }

  function saveSettings() {
    localStorage.setItem("ai_model", settings.model);
    localStorage.setItem("ai_temp", settings.temperature);
  }

  const bg = "#1a1a1f";
  const bgCard = "#16161c";
  const bgInput = "#222230";
  const border = "#2a2a33";
  const accent = "#a78bfa";
  const textMain = "#e8e8ec";
  const textSub = "#666";
  const textMuted = "#444";

  const navItems: { id: Tab; icon: string; label: string }[] = [
    { id: "characters", icon: "Users", label: "Персонажи" },
    { id: "chat", icon: "MessageCircle", label: "Чат" },
    { id: "create", icon: "PlusCircle", label: "Создать" },
    { id: "history", icon: "Clock", label: "История" },
    { id: "settings", icon: "Settings2", label: "Настройки" },
  ];

  // Список персонажей — общий компонент
  function CharList({ chars, showOwner = false }: { chars: Character[]; showOwner?: boolean }) {
    if (chars.length === 0) return (
      <div className="text-center py-16 animate-fade-in">
        <div className="text-4xl mb-3">🤖</div>
        <p style={{ color: textSub }}>Персонажей пока нет</p>
        <button onClick={() => setTab("create")} className="mt-4 px-6 py-2.5 rounded-2xl text-sm font-semibold" style={{ background: accent, color: "#fff" }}>
          Создать первого
        </button>
      </div>
    );
    return (
      <div className="space-y-2">
        {chars.map((char, i) => {
          const isOwner = char.owner_id === userId;
          const canChat = char.is_public || isOwner;
          return (
            <div
              key={char.id}
              className="group flex items-center gap-4 p-4 rounded-2xl border transition-all animate-fade-in"
              style={{ borderColor: border, background: bgCard, animationDelay: `${i * 0.04}s`, opacity: canChat ? 1 : 0.5, cursor: canChat ? "pointer" : "default" }}
              onClick={() => canChat && selectCharacter(char)}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden" style={{ background: "#222230" }}>
                {char.avatar_url
                  ? <img src={char.avatar_url} alt={char.name} className="w-full h-full object-cover" />
                  : <span className="text-2xl">{char.avatar_emoji}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold" style={{ color: textMain }}>{char.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: char.is_public ? "#1a2e1a" : "#2a1a2a", color: char.is_public ? "#4ade80" : "#c084fc" }}>
                    {char.is_public ? "Публичный" : "Приватный"}
                  </span>
                  {!char.is_public && !isOwner && <span className="text-xs" style={{ color: textMuted }}>🔒 только автор</span>}
                </div>
                <p className="text-sm truncate mt-0.5" style={{ color: textSub }}>{char.description}</p>
              </div>
              {isOwner && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={e => { e.stopPropagation(); togglePublic(char); }} className="p-2 rounded-xl" style={{ color: textSub }} title={char.is_public ? "Сделать приватным" : "Сделать публичным"}>
                    <Icon name={char.is_public ? "Globe" : "Lock"} size={15} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); deleteCharacter(char.id); }} className="p-2 rounded-xl" style={{ color: textSub }}>
                    <Icon name="Trash2" size={15} />
                  </button>
                </div>
              )}
              {canChat && <Icon name="ChevronRight" size={16} style={{ color: textMuted }} />}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: bg, fontFamily: "'Golos Text', sans-serif", color: textMain }}>

      {/* SIDEBAR */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50 w-72 h-full flex flex-col animate-slide-in" style={{ background: "#111116" }}>

            {/* Profile block */}
            <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: border }}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-bold">My<span style={{ color: accent }}>.AI</span></span>
                <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-xl" style={{ color: textSub }}>
                  <Icon name="X" size={18} />
                </button>
              </div>
              <button
                onClick={() => { setTab("profile"); setSidebarOpen(false); }}
                className="flex items-center gap-3 w-full rounded-2xl p-2 transition-all"
                style={{ background: tab === "profile" ? "#2a2a38" : "transparent" }}
              >
                <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center shrink-0" style={{ background: "#222230" }}>
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    : <Icon name="User" size={22} style={{ color: textSub }} />}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm" style={{ color: textMain }}>{profile.nickname}</p>
                  <p className="text-xs" style={{ color: textSub }}>Мой профиль</p>
                </div>
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setTab(item.id); setSidebarOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all"
                  style={{ background: tab === item.id ? "#2a2a38" : "transparent", color: tab === item.id ? accent : textSub }}
                >
                  <Icon name={item.icon} size={18} />
                  {item.label}
                </button>
              ))}
              <button
                onClick={() => { setTab("mine"); setSidebarOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all"
                style={{ background: tab === "mine" ? "#2a2a38" : "transparent", color: tab === "mine" ? accent : textSub }}
              >
                <Icon name="Star" size={18} />
                Мои персонажи
              </button>

              {characters.length > 0 && (
                <>
                  <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: "#333" }}>Последние</div>
                  {characters.slice(0, 5).map(char => (
                    <button
                      key={char.id}
                      onClick={() => selectCharacter(char)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm transition-all"
                      style={{ background: activeChar?.id === char.id ? "#2a2a38" : "transparent", color: activeChar?.id === char.id ? textMain : textSub }}
                    >
                      <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shrink-0" style={{ background: "#222230" }}>
                        {char.avatar_url ? <img src={char.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-sm">{char.avatar_emoji}</span>}
                      </div>
                      <span className="truncate">{char.name}</span>
                      {!char.is_public && <Icon name="Lock" size={11} className="ml-auto shrink-0" style={{ color: textMuted }} />}
                    </button>
                  ))}
                </>
              )}
            </nav>

            <div className="px-5 py-3 border-t text-xs" style={{ borderColor: border, color: textMuted }}>My.AI — ИИ-персонажи</div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b" style={{ background: "#111116", borderColor: "#222228" }}>
        <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl" style={{ color: textSub }}>
          <Icon name="Menu" size={22} />
        </button>
        <span className="text-lg font-bold tracking-tight">My<span style={{ color: accent }}>.AI</span></span>
        {activeChar && tab === "chat" && (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center" style={{ background: "#222230" }}>
              {activeChar.avatar_url ? <img src={activeChar.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-sm">{activeChar.avatar_emoji}</span>}
            </div>
            <span className="font-medium" style={{ color: "#ccc" }}>{activeChar.name}</span>
          </div>
        )}
      </header>

      {/* MAIN */}
      <main className="flex-1 overflow-hidden flex flex-col max-w-2xl w-full mx-auto">

        {/* CHARACTERS */}
        {tab === "characters" && (
          <div className="flex-1 overflow-y-auto p-5">
            <h1 className="text-2xl font-bold mb-1">Персонажи</h1>
            <p className="text-sm mb-5" style={{ color: textSub }}>Публичные и ваши приватные</p>
            <CharList chars={characters} />
          </div>
        )}

        {/* MY CHARACTERS */}
        {tab === "mine" && (
          <div className="flex-1 overflow-y-auto p-5">
            <h1 className="text-2xl font-bold mb-1">Мои персонажи</h1>
            <p className="text-sm mb-5" style={{ color: textSub }}>Персонажи, которых вы создали</p>
            <CharList chars={myChars} showOwner />
          </div>
        )}

        {/* PROFILE */}
        {tab === "profile" && (
          <div className="flex-1 overflow-y-auto p-5">
            <h1 className="text-2xl font-bold mb-5">Мой профиль</h1>
            <div className="space-y-5 animate-fade-in">
              {/* Аватарка */}
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center cursor-pointer relative group"
                  style={{ background: "#222230", border: `2px solid ${border}` }}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    : <Icon name="User" size={36} style={{ color: textSub }} />}
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                    <Icon name="Camera" size={22} style={{ color: "#fff" }} />
                  </div>
                </div>
                <p className="text-xs" style={{ color: textSub }}>Нажмите чтобы изменить фото</p>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                {savingProfile && <p className="text-xs" style={{ color: accent }}>Загружаю...</p>}
              </div>

              {/* Никнейм */}
              <div>
                <label className="text-sm font-medium block mb-2" style={{ color: "#888" }}>Никнейм</label>
                <input
                  value={editNick}
                  onChange={e => setEditNick(e.target.value)}
                  placeholder="Ваш никнейм"
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none placeholder-neutral-600"
                  style={{ background: bgInput, color: textMain, border: `1px solid ${border}` }}
                />
              </div>
              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="w-full py-3 rounded-2xl text-sm font-semibold disabled:opacity-40"
                style={{ background: accent, color: "#fff" }}
              >
                Сохранить
              </button>

              <div className="pt-2 border-t" style={{ borderColor: border }}>
                <p className="text-xs" style={{ color: textMuted }}>ID: {userId}</p>
              </div>
            </div>
          </div>
        )}

        {/* CHAT */}
        {tab === "chat" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {!activeChar ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center animate-fade-in">
                  <div className="text-5xl mb-4">💬</div>
                  <p className="mb-5" style={{ color: textSub }}>Выберите персонажа для разговора</p>
                  <button onClick={() => setTab("characters")} className="px-6 py-2.5 rounded-2xl text-sm font-semibold" style={{ background: accent, color: "#fff" }}>
                    К персонажам
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {messages.length === 0 && (
                    <div className="text-center py-12 animate-fade-in">
                      <div className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center mx-auto mb-3" style={{ background: "#222230" }}>
                        {activeChar.avatar_url ? <img src={activeChar.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-4xl">{activeChar.avatar_emoji}</span>}
                      </div>
                      <p className="font-semibold mb-1" style={{ color: "#ccc" }}>{activeChar.name}</p>
                      <p className="text-sm" style={{ color: textSub }}>Начните разговор</p>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div key={msg.id} className={`flex animate-msg-in ${msg.role === "user" ? "justify-end" : "justify-start"}`} style={{ animationDelay: `${i * 0.02}s` }}>
                      {msg.role === "assistant" && (
                        <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center mr-2 shrink-0 self-end" style={{ background: "#222230" }}>
                          {activeChar.avatar_url ? <img src={activeChar.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-base">{activeChar.avatar_emoji}</span>}
                        </div>
                      )}
                      <div
                        className="max-w-xs md:max-w-sm px-4 py-3 rounded-2xl text-sm leading-relaxed"
                        style={msg.role === "user"
                          ? { background: accent, color: "#fff", borderBottomRightRadius: "4px" }
                          : { background: "#222230", color: "#ddd", borderBottomLeftRadius: "4px" }}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start animate-fade-in">
                      <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center mr-2 shrink-0" style={{ background: "#222230" }}>
                        {activeChar.avatar_url ? <img src={activeChar.avatar_url} alt="" className="w-full h-full object-cover" /> : <span className="text-base">{activeChar.avatar_emoji}</span>}
                      </div>
                      <div className="px-4 py-3 rounded-2xl" style={{ background: "#222230", borderBottomLeftRadius: "4px" }}>
                        <div className="flex gap-1">
                          {[0, 1, 2].map(j => <div key={j} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#555", animationDelay: `${j * 0.15}s` }} />)}
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
                      style={{ background: bgInput, color: textMain, border: `1px solid ${border}` }}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={loading || !input.trim()}
                      className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all shrink-0 disabled:opacity-30"
                      style={{ background: accent, color: "#fff" }}
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
            <h1 className="text-2xl font-bold mb-1">Новый персонаж</h1>
            <p className="text-sm mb-5" style={{ color: textSub }}>Опишите характер и роль</p>
            <div className="space-y-5 animate-fade-in">

              {/* Фото персонажа */}
              <div>
                <label className="text-sm font-medium block mb-2" style={{ color: "#888" }}>Фото персонажа</label>
                <div className="flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-2xl overflow-hidden flex items-center justify-center cursor-pointer relative group"
                    style={{ background: "#222230", border: `1px dashed ${border}` }}
                    onClick={() => charImgInputRef.current?.click()}
                  >
                    {newCharImg
                      ? <img src={`data:${newCharImgType};base64,${newCharImg}`} alt="preview" className="w-full h-full object-cover" />
                      : <Icon name="ImagePlus" size={24} style={{ color: textSub }} />}
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
                      <Icon name="Camera" size={18} style={{ color: "#fff" }} />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: "#888" }}>или выберите эмодзи:</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {EMOJIS.slice(0, 8).map(e => (
                        <button key={e} onClick={() => setNewEmoji(e)} className="w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all" style={{ background: newEmoji === e && !newCharImg ? accent : "#222230", transform: newEmoji === e && !newCharImg ? "scale(1.1)" : "scale(1)" }}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <input ref={charImgInputRef} type="file" accept="image/*" className="hidden" onChange={handleCharImgChange} />
              </div>

              <div>
                <label className="text-sm font-medium block mb-2" style={{ color: "#888" }}>Имя персонажа</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Например: Мудрый волшебник"
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none placeholder-neutral-600"
                  style={{ background: bgInput, color: textMain, border: `1px solid ${border}` }} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-2" style={{ color: "#888" }}>Описание и характер</label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Опишите кто это, как говорит, что знает..." rows={4}
                  className="w-full px-4 py-3 rounded-2xl text-sm outline-none placeholder-neutral-600 resize-none"
                  style={{ background: bgInput, color: textMain, border: `1px solid ${border}` }} />
              </div>

              {/* Privacy */}
              <div className="flex items-center justify-between p-4 rounded-2xl" style={{ background: bgCard, border: `1px solid ${border}` }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "#ccc" }}>{newIsPublic ? "Публичный" : "Приватный"}</p>
                  <p className="text-xs mt-0.5" style={{ color: textMuted }}>{newIsPublic ? "Виден всем" : "Только вы можете общаться"}</p>
                </div>
                <button onClick={() => setNewIsPublic(!newIsPublic)} className="w-12 h-6 rounded-full transition-all relative shrink-0" style={{ background: newIsPublic ? accent : "#2a2a38" }}>
                  <div className="absolute top-0.5 w-5 h-5 rounded-full transition-all" style={{ background: "#fff", left: newIsPublic ? "calc(100% - 22px)" : "2px" }} />
                </button>
              </div>

              <button onClick={createCharacter} disabled={creating || !newName.trim() || !newDesc.trim()}
                className="w-full py-3 rounded-2xl text-sm font-semibold transition-all disabled:opacity-40"
                style={{ background: accent, color: "#fff" }}>
                {creating ? "Создаю..." : "Создать персонажа"}
              </button>
            </div>
          </div>
        )}

        {/* HISTORY */}
        {tab === "history" && (
          <div className="flex-1 overflow-y-auto p-5">
            <h1 className="text-2xl font-bold mb-3">История</h1>
            <div className="relative mb-4">
              <Icon name="Search" size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: textSub }} />
              <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); loadHistory(e.target.value); }}
                placeholder="Поиск по диалогам..."
                className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm outline-none placeholder-neutral-600"
                style={{ background: bgInput, color: textMain, border: `1px solid ${border}` }} />
            </div>
            {historyAll.length === 0 ? (
              <div className="text-center py-16 animate-fade-in">
                <div className="text-4xl mb-3">📭</div>
                <p style={{ color: textSub }}>{searchQuery ? "Ничего не найдено" : "История пуста"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {historyAll.map((msg, i) => (
                  <div key={msg.id} className="flex gap-3 p-3 rounded-2xl animate-fade-in" style={{ background: msg.role === "user" ? bgCard : "#1a1a24", animationDelay: `${i * 0.03}s` }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0" style={{ background: "#222230" }}>
                      {msg.role === "user" ? "👤" : msg.avatar_emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold" style={{ color: "#777" }}>{msg.role === "user" ? "Вы" : msg.char_name}</span>
                        <span className="text-xs" style={{ color: textMuted }}>{msg.created_at?.slice(0, 10)}</span>
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
            <h1 className="text-2xl font-bold mb-1">Настройки</h1>
            <p className="text-sm mb-5" style={{ color: textSub }}>Параметры модели ИИ</p>
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl flex gap-3" style={{ background: "#1e1a10", border: "1px solid #3a3010" }}>
                <Icon name="KeyRound" size={18} className="shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#fbbf24" }}>OpenRouter API ключ</p>
                  <p className="text-xs mt-0.5" style={{ color: "#856c30" }}>В разделе «Ядро → Секреты» как OPENROUTER_API_KEY. Получить на openrouter.ai</p>
                </div>
              </div>
              <div className="p-4 rounded-2xl" style={{ background: bgCard, border: `1px solid ${border}` }}>
                <label className="text-sm font-medium block mb-2" style={{ color: "#888" }}>Модель</label>
                <select value={settings.model} onChange={e => setSettings(s => ({ ...s, model: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: bgInput, color: textMain, border: `1px solid ${border}` }}>
                  <option value="openai/gpt-3.5-turbo">GPT-3.5 Turbo (быстрый)</option>
                  <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
                  <option value="openai/gpt-4o">GPT-4o (умный)</option>
                  <option value="anthropic/claude-3-haiku">Claude 3 Haiku</option>
                  <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="google/gemini-flash-1.5">Gemini Flash 1.5</option>
                </select>
              </div>
              <div className="p-4 rounded-2xl" style={{ background: bgCard, border: `1px solid ${border}` }}>
                <label className="text-sm font-medium block mb-3" style={{ color: "#888" }}>
                  Креативность: <span className="font-bold" style={{ color: accent }}>{settings.temperature}</span>
                </label>
                <input type="range" min="0" max="2" step="0.1" value={settings.temperature}
                  onChange={e => setSettings(s => ({ ...s, temperature: e.target.value }))}
                  className="w-full" style={{ accentColor: accent }} />
                <div className="flex justify-between text-xs mt-1" style={{ color: textMuted }}>
                  <span>Точный</span><span>Творческий</span>
                </div>
              </div>
              <button onClick={saveSettings} className="w-full py-3 rounded-2xl text-sm font-semibold" style={{ background: accent, color: "#fff" }}>
                Сохранить
              </button>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM NAV */}
      <nav className="border-t" style={{ background: "#111116", borderColor: "#222228" }}>
        <div className="max-w-2xl mx-auto flex justify-around px-2 py-1">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-all"
              style={{ color: tab === item.id ? accent : textMuted }}>
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
