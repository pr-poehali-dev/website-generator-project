import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

const API = {
  characters: "https://functions.poehali.dev/f9ac5731-8a63-45d0-9f59-9cf38f368cba",
  chat: "https://functions.poehali.dev/73cc788d-177f-40b4-9416-e935f4b8f65c",
  history: "https://functions.poehali.dev/ff9f3482-ca76-4699-97ba-73f43177f7ac",
};

const EMOJIS = ["🤖", "🧙", "🦊", "🐉", "👸", "🕵️", "🧛", "🦸", "🧜", "🎭", "👾", "🦁"];

type Tab = "characters" | "chat" | "create" | "history" | "settings";

interface Character {
  id: number;
  name: string;
  description: string;
  avatar_emoji: string;
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
    const res = await fetch(API.chat, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ char_id: activeChar.id, message: userMsg, model: settings.model, temperature: parseFloat(settings.temperature) }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.reply) {
      setMessages(prev => [...prev, { id: Date.now() + 1, role: "assistant", content: data.reply, created_at: "" }]);
    }
  }

  async function createCharacter() {
    if (!newName.trim() || !newDesc.trim()) return;
    setCreating(true);
    await fetch(API.characters, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, description: newDesc, avatar_emoji: newEmoji }),
    });
    setCreating(false);
    setNewName(""); setNewDesc(""); setNewEmoji("🤖");
    await loadCharacters();
    setTab("characters");
  }

  async function deleteCharacter(id: number) {
    await fetch(`${API.characters}?id=${id}`, { method: "DELETE" });
    await loadCharacters();
    if (activeChar?.id === id) { setActiveChar(null); setMessages([]); }
  }

  function saveSettings() {
    localStorage.setItem("ai_model", settings.model);
    localStorage.setItem("ai_temp", settings.temperature);
  }

  const navItems: { id: Tab; icon: string; label: string }[] = [
    { id: "characters", icon: "Users", label: "Персонажи" },
    { id: "chat", icon: "MessageCircle", label: "Чат" },
    { id: "create", icon: "Plus", label: "Создать" },
    { id: "history", icon: "Clock", label: "История" },
    { id: "settings", icon: "Settings", label: "Настройки" },
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ fontFamily: "'Golos Text', sans-serif" }}>
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center text-white text-sm font-bold">А</div>
          <span className="text-gray-900 font-semibold text-lg tracking-tight">ИИ-Персонажи</span>
        </div>
        {activeChar && tab === "chat" && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="text-base">{activeChar.avatar_emoji}</span>
            <span className="font-medium text-gray-700">{activeChar.name}</span>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 overflow-hidden flex flex-col max-w-2xl w-full mx-auto">
        {/* Characters tab */}
        {tab === "characters" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Персонажи</h1>
              <p className="text-gray-400 text-sm">Выберите с кем поговорить</p>
            </div>
            {characters.length === 0 ? (
              <div className="text-center py-20 animate-fade-in">
                <div className="text-5xl mb-4">🤖</div>
                <p className="text-gray-400 mb-4">Персонажей пока нет</p>
                <button
                  onClick={() => setTab("create")}
                  className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  Создать первого
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {characters.map((char, i) => (
                  <div
                    key={char.id}
                    className="group flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all cursor-pointer animate-fade-in"
                    style={{ animationDelay: `${i * 0.05}s` }}
                    onClick={() => selectCharacter(char)}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl shrink-0">
                      {char.avatar_emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900">{char.name}</div>
                      <div className="text-sm text-gray-400 truncate">{char.description}</div>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); deleteCharacter(char.id); }}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-400 transition-all"
                    >
                      <Icon name="Trash2" size={16} />
                    </button>
                    <Icon name="ChevronRight" size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chat tab */}
        {tab === "chat" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {!activeChar ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center animate-fade-in">
                  <div className="text-4xl mb-3">💬</div>
                  <p className="text-gray-400 mb-4">Выберите персонажа для разговора</p>
                  <button
                    onClick={() => setTab("characters")}
                    className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
                  >
                    К персонажам
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div ref={chatRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                  {messages.length === 0 && (
                    <div className="text-center py-10 animate-fade-in">
                      <div className="text-4xl mb-2">{activeChar.avatar_emoji}</div>
                      <p className="text-gray-400 text-sm">Начните разговор с {activeChar.name}</p>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div
                      key={msg.id}
                      className={`flex animate-msg-in ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      style={{ animationDelay: `${i * 0.02}s` }}
                    >
                      {msg.role === "assistant" && (
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-base mr-2 shrink-0 self-end">
                          {activeChar.avatar_emoji}
                        </div>
                      )}
                      <div
                        className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-gray-900 text-white rounded-br-sm"
                            : "bg-gray-100 text-gray-800 rounded-bl-sm"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start animate-fade-in">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-base mr-2 shrink-0">
                        {activeChar.avatar_emoji}
                      </div>
                      <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                        <div className="flex gap-1">
                          {[0, 1, 2].map(i => (
                            <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 border-t border-gray-100">
                  <div className="flex gap-2">
                    <input
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                      placeholder="Напишите сообщение..."
                      className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 text-sm outline-none focus:border-gray-400 transition-colors bg-gray-50 placeholder-gray-400"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={loading || !input.trim()}
                      className="w-11 h-11 bg-gray-900 text-white rounded-2xl flex items-center justify-center hover:bg-gray-700 transition-colors disabled:opacity-40 shrink-0"
                    >
                      <Icon name="Send" size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Create tab */}
        {tab === "create" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Новый персонаж</h1>
              <p className="text-gray-400 text-sm">Опишите характер и роль персонажа</p>
            </div>
            <div className="space-y-5 animate-fade-in">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Аватар</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map(e => (
                    <button
                      key={e}
                      onClick={() => setNewEmoji(e)}
                      className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                        newEmoji === e ? "bg-gray-900 shadow-sm scale-105" : "bg-gray-100 hover:bg-gray-200"
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Имя персонажа</label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Например: Мудрый волшебник"
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm outline-none focus:border-gray-400 transition-colors bg-gray-50 placeholder-gray-400"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Описание и характер</label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Опишите кто это, как говорит, что знает..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm outline-none focus:border-gray-400 transition-colors bg-gray-50 placeholder-gray-400 resize-none"
                />
              </div>
              <button
                onClick={createCharacter}
                disabled={creating || !newName.trim() || !newDesc.trim()}
                className="w-full py-3 bg-gray-900 text-white rounded-2xl text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-40"
              >
                {creating ? "Создаю..." : "Создать персонажа"}
              </button>
            </div>
          </div>
        )}

        {/* History tab */}
        {tab === "history" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-5">
              <h1 className="text-2xl font-bold text-gray-900 mb-3">История</h1>
              <div className="relative">
                <Icon name="Search" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); loadHistory(e.target.value); }}
                  placeholder="Поиск по диалогам..."
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 text-sm outline-none focus:border-gray-400 transition-colors bg-gray-50 placeholder-gray-400"
                />
              </div>
            </div>
            {historyAll.length === 0 ? (
              <div className="text-center py-16 animate-fade-in">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-gray-400">{searchQuery ? "Ничего не найдено" : "История пуста"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {historyAll.map((msg, i) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 p-3 rounded-2xl animate-fade-in ${msg.role === "user" ? "bg-gray-50" : "bg-white border border-gray-100"}`}
                    style={{ animationDelay: `${i * 0.03}s` }}
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm shrink-0">
                      {msg.role === "user" ? "👤" : msg.avatar_emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-gray-500">
                          {msg.role === "user" ? "Вы" : msg.char_name}
                        </span>
                        <span className="text-xs text-gray-300">{msg.created_at?.slice(0, 10)}</span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">{msg.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Settings tab */}
        {tab === "settings" && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Настройки</h1>
              <p className="text-gray-400 text-sm">Параметры модели ИИ</p>
            </div>
            <div className="space-y-5 animate-fade-in">
              <div className="p-4 rounded-2xl border border-amber-100 bg-amber-50 flex gap-3">
                <Icon name="KeyRound" size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">API ключ OpenAI</p>
                  <p className="text-xs text-amber-600 mt-0.5">Ключ настраивается в разделе «Ядро → Секреты» как OPENAI_API_KEY</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Модель GPT</label>
                <select
                  value={settings.model}
                  onChange={e => setSettings(s => ({ ...s, model: e.target.value }))}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm outline-none focus:border-gray-400 transition-colors bg-gray-50 text-gray-700"
                >
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (быстрый)</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o (умный)</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Креативность: <span className="text-gray-900 font-semibold">{settings.temperature}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.temperature}
                  onChange={e => setSettings(s => ({ ...s, temperature: e.target.value }))}
                  className="w-full accent-gray-900"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Точный</span>
                  <span>Творческий</span>
                </div>
              </div>
              <button
                onClick={saveSettings}
                className="w-full py-3 bg-gray-900 text-white rounded-2xl text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Сохранить настройки
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="border-t border-gray-100 bg-white px-2 py-2">
        <div className="max-w-2xl mx-auto flex justify-around">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all ${
                tab === item.id ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${tab === item.id ? "bg-gray-100" : ""}`}>
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
