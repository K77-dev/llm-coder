'use client';

import { ChatInterface } from '../../components/ChatInterface';
import { Sidebar } from '../../components/Sidebar';

export default function ChatPage() {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-neutral-950">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <ChatInterface />
      </main>
    </div>
  );
}
