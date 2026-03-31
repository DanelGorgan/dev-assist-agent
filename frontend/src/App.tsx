import { useState } from "react";
import { useChat } from "./useChat";
import ReactMarkdown from "react-markdown";

function App() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, isLoading } = useChat();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
    setInput("");
  };

  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto p-4 sm:p-6 lg:p-8">
      <header className="py-6 border-b border-slate-700">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
          DevAssist Agent
        </h1>
        <p className="text-slate-400 mt-2">v0.1.0 - Foundation Check</p>
      </header>

      <main className="flex-1 overflow-y-auto py-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
            <div className="text-5xl">🤖</div>
            <p className="text-lg">No messages yet.</p>
            <p className="text-sm">
              Ask me about tasks, create PRs, run tests, or type "help" to see
              what I can do!
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none"
                }`}
              >
                <div className="text-[10px] font-bold mb-1.5 opacity-60 uppercase tracking-widest">
                  {msg.role}
                </div>
                <div className="leading-relaxed prose prose-invert prose-sm max-w-none">
                  {msg.role === "user" ? (
                    msg.content
                  ) : (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 text-slate-400 border border-slate-700 rounded-2xl rounded-bl-none p-5 w-24 shadow-sm">
              <div className="flex space-x-2 animate-pulse justify-center">
                <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
                <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-4 mt-auto">
        <form onSubmit={handleSubmit} className="flex gap-3 items-center">
          <input
            type="text"
            className="flex-1 bg-slate-800/80 border border-slate-700 rounded-full px-6 py-4 text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-500"
            placeholder="Type a message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-medium rounded-full px-8 py-4 transition-colors shadow-lg shadow-blue-500/20"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}

export default App;
