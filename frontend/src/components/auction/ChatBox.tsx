import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { timeAgo } from '../../utils/format';
import socketService from '../../services/socketService';
import useAuctionStore from '../../store/auctionStore';
import useAuthStore from '../../store/authStore';
import clsx from 'clsx';

interface ChatBoxProps {
  auctionId: string;
}

const ChatBox: React.FC<ChatBoxProps> = ({ auctionId }) => {
  const { chatMessages } = useAuctionStore();
  const { user } = useAuthStore();
  const [message, setMessage] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;
    socketService.sendChatMessage(auctionId, trimmed);
    setMessage('');
  };

  return (
    <div className="bg-gray-800 rounded-xl flex flex-col h-72">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
        <MessageSquare size={16} className="text-blue-400" />
        <span className="font-semibold text-white text-sm">Live Chat</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {chatMessages.length === 0 ? (
          <p className="text-gray-500 text-xs text-center pt-4">No messages yet</p>
        ) : (
          chatMessages.map((msg) => {
            const isMe = msg.userId === user?.id;
            return (
              <div key={msg.id} className={clsx('flex flex-col', isMe && 'items-end')}>
                <div className={clsx(
                  'max-w-[80%] rounded-lg px-3 py-1.5 text-sm',
                  isMe ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'
                )}>
                  {!isMe && (
                    <p className="text-xs text-gray-400 mb-0.5 font-medium">{msg.userName}</p>
                  )}
                  <p className="break-words">{msg.message}</p>
                </div>
                <span className="text-xs text-gray-600 mt-0.5 px-1">{timeAgo(msg.timestamp)}</span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={handleSend} className="p-3 border-t border-gray-700 flex gap-2">
        <input
          type="text"
          placeholder="Type a message…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={!message.trim()}
          className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
};

export default ChatBox;
