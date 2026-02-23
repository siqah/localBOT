import { useState, useRef, useEffect } from 'react';
import {
    Send, Sparkles, FileText, ChevronDown, ChevronUp,
    Loader2, MessageSquare, Brain, Zap, BookOpen, Code
} from 'lucide-react';
import { api, type ChatResponse, type SourceRef } from '../lib/api';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    sources?: SourceRef[];
    timestamp: Date;
}

export default function ChatView() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        const question = input.trim();
        if (!question || isLoading) return;

        const userMsg: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: question,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const response: ChatResponse = await api.chat(question, sessionId || undefined);
            setSessionId(response.session_id);

            const assistantMsg: Message = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: response.answer,
                sources: response.sources,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMsg]);
        } catch (err: any) {
            const errorMsg: Message = {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: `⚠️ ${err.message || 'Failed to get response. Is the backend running?'}`,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const suggestedQuestions = [
        { icon: BookOpen, text: 'Summarize my uploaded documents' },
        { icon: Code, text: 'Find code examples in my knowledge base' },
        { icon: Zap, text: 'What are the key takeaways from my notes?' },
        { icon: Brain, text: 'Help me understand a concept from my files' },
    ];

    return (
        <div className="flex flex-col h-full">
            {/* Messages Area */}
            <div className="flex-1 overflow-auto px-4 py-6">
                {messages.length === 0 ? (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto animate-fade-in">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-500/20 to-primary-700/20 border border-primary-500/20 flex items-center justify-center mb-6">
                            <Brain className="w-10 h-10 text-primary-500 dark:text-primary-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">Ask me anything</h2>
                        <p className="text-surface-500 dark:text-surface-400 text-center mb-8 max-w-md">
                            I'll search your local knowledge base and provide answers with source citations.
                            All processing happens on your device — nothing leaves your machine.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                            {suggestedQuestions.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => setInput(q.text)}
                                    className="glass-card-hover p-4 text-left group"
                                >
                                    <div className="flex items-start gap-3">
                                        <q.icon className="w-4 h-4 text-primary-500 dark:text-primary-400 mt-0.5 flex-shrink-0" />
                                        <span className="text-sm text-surface-600 dark:text-surface-300 group-hover:text-surface-900 dark:group-hover:text-white transition-colors">
                                            {q.text}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    /* Message List */
                    <div className="max-w-3xl mx-auto space-y-6">
                        {messages.map(msg => (
                            <MessageBubble key={msg.id} message={msg} />
                        ))}

                        {isLoading && (
                            <div className="flex gap-3 animate-fade-in">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center flex-shrink-0">
                                    <Sparkles className="w-4 h-4 text-white" />
                                </div>
                                <div className="glass-card px-4 py-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="typing-dot" />
                                        <div className="typing-dot" />
                                        <div className="typing-dot" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="border-t border-surface-200 dark:border-surface-800/50 p-4 bg-white/80 dark:bg-surface-950/80 backdrop-blur-xl">
                <div className="max-w-3xl mx-auto">
                    <div className="glass-card flex items-end gap-3 p-3">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Ask a question about your knowledge base..."
                            className="flex-1 bg-transparent text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500 border-none outline-none resize-none text-sm leading-relaxed max-h-32"
                            rows={1}
                            id="chat-input"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="btn-primary disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none p-2.5 rounded-xl"
                            id="send-button"
                        >
                            {isLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                    <p className="text-[10px] text-surface-600 text-center mt-2">
                        All queries processed locally • Your data never leaves this device
                    </p>
                </div>
            </div>
        </div>
    );
}

// ── Message Bubble Component ─────────────────────

function MessageBubble({ message }: { message: Message }) {
    const [sourcesExpanded, setSourcesExpanded] = useState(false);
    const isUser = message.role === 'user';

    return (
        <div className={`flex gap-3 animate-slide-up ${isUser ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isUser
                ? 'bg-surface-200 dark:bg-surface-700'
                : 'bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/20'
                }`}>
                {isUser ? (
                    <MessageSquare className="w-4 h-4 text-surface-500 dark:text-surface-300" />
                ) : (
                    <Sparkles className="w-4 h-4 text-white" />
                )}
            </div>

            {/* Content */}
            <div className={`max-w-[80%] ${isUser ? 'text-right' : ''}`}>
                <div className={`inline-block text-left ${isUser
                    ? 'bg-primary-600/20 border border-primary-500/20 rounded-2xl rounded-tr-md px-4 py-3'
                    : 'glass-card px-4 py-3'
                    }`}>
                    <div className="prose-content text-sm">
                        {message.content}
                    </div>
                </div>

                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                    <div className="mt-2">
                        <button
                            onClick={() => setSourcesExpanded(!sourcesExpanded)}
                            className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-primary-400 transition-colors"
                        >
                            <FileText className="w-3 h-3" />
                            <span>{message.sources.length} source{message.sources.length > 1 ? 's' : ''}</span>
                            {sourcesExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {sourcesExpanded && (
                            <div className="mt-2 space-y-2 animate-slide-up">
                                {message.sources.map((source, i) => (
                                    <div key={i} className="glass-card p-3 text-xs">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <FileText className="w-3 h-3 text-primary-400" />
                                            <span className="font-medium text-surface-700 dark:text-surface-300">{source.document_name}</span>
                                            <span className="badge-neutral text-[10px] ml-auto">
                                                {(source.score * 100).toFixed(0)}% match
                                            </span>
                                        </div>
                                        <p className="text-surface-500 line-clamp-3 leading-relaxed">
                                            {source.chunk_content}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <p className="text-[10px] text-surface-600 mt-1.5">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
        </div>
    );
}
