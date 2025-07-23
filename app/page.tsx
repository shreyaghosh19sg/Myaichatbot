'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Upload } from 'lucide-react';
import { motion } from 'framer-motion';
import { GoogleGenAI } from '@google/genai';

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

const loadPdfJs = async (): Promise<void> => {
  if (!window.pdfjsLib) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        resolve();
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }
};

const ai = new GoogleGenAI({
  apiKey: 'AIzaSyAiY4oeYSmXWAyWkAiyV30f5j6AJ0-mYOY',
});
const model = 'gemini-1.5-flash';

type Message = {
  id: string;
  sender: 'user' | 'bot' | 'system';
  content: string;
};

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [parsedPDFContent, setParsedPDFContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatMessagesForGemini = () => {
    return messages
      .filter((msg) => msg.sender !== 'system')
      .map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));
  };

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const combinedPrompt = `${input.trim()}\n\n[PDF Content Context]:\n${parsedPDFContent}`;
      const contents = [...formatMessagesForGemini(), {
        role: 'user',
        parts: [{ text: combinedPrompt }],
      }];

      const config = { responseMimeType: 'text/plain' };
      const response = await ai.models.generateContentStream({ model, config, contents });

      let botText = '';
      for await (const chunk of response) {
        if (chunk.text) botText += chunk.text;
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        content: botText,
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 2).toString(),
        sender: 'bot',
        content: '❗ Something went wrong. Please try again.',
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') sendMessage();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') return;

    await loadPdfJs();

    const fileReader = new FileReader();
    fileReader.onload = async () => {
      const typedarray = new Uint8Array(fileReader.result as ArrayBuffer);
      try {
        const pdf = await window.pdfjsLib.getDocument({ data: typedarray }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const text = content.items.map((item: any) => item.str).join(' ');
          fullText += `\n\nPage ${i}:\n${text}`;
        }

        setParsedPDFContent(fullText);
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), sender: 'system', content: `📎 PDF uploaded: **${file.name}**` },
        ]);
      } catch (err) {
        console.error('Error parsing PDF:', err);
      }
    };

    fileReader.readAsArrayBuffer(file);
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-[#111827] to-[#1f2937] p-6 text-gray-300 flex flex-col gap-4 shadow-xl">
        <h2 className="text-xl font-bold text-white">🚀 Myaichatbot</h2>
        <nav className="flex flex-col gap-2 text-sm">
          {["Chat", "Stream", "Generate Media", "Build", "History", "Enable saving"].map((item) => (
            <span key={item} className="cursor-pointer hover:text-blue-400 transition-all duration-200">{item}</span>
          ))}
        </nav>
      </aside>

      {/* Main Chat */}
      <main className="flex-1 flex flex-col p-6">
        <h1 className="text-3xl font-bold mb-4 text-white">
          Welcome to <span className="text-blue-400">Myaichatbot</span>
        </h1>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`max-w-[75%] px-4 py-3 rounded-xl text-sm shadow-md whitespace-pre-wrap ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white ml-auto'
                  : msg.sender === 'bot'
                  ? 'bg-[#2a2a40] text-blue-100'
                  : 'bg-[#3d3d5c] text-yellow-200 mx-auto'
              }`}
            >
              {msg.content}
            </motion.div>
          ))}

          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-[#444] text-white px-4 py-2 rounded-lg text-sm w-fit"
            >
              Typing...
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="mt-4 flex items-center gap-2 bg-[#1e1e2f] p-3 rounded-xl shadow-lg">
          <input
            className="flex-1 bg-[#2a2a40] text-white border border-gray-600 rounded px-4 py-2 placeholder-gray-400"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
          />
          <button
            onClick={sendMessage}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded flex items-center gap-1 hover:from-blue-600 hover:to-indigo-700 transition-all"
          >
            <Send size={16} /> Send
          </button>
          <label className="cursor-pointer flex items-center gap-2 text-gray-300 hover:text-white transition">
            <Upload size={16} />
            <input type="file" accept="application/pdf" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </main>
    </div>
  );
}
