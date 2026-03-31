import { useState } from 'react';

export interface Message {
  role: 'user' | 'agent';
  content: string;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (message: string) => {
    if (!message.trim()) return;
    
    // Optimistically add user message
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'agent', content: data.reply }]);
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, { role: 'agent', content: 'Connection error. Make sure the NestJS backend is running on port 3000.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return { messages, sendMessage, isLoading };
}
