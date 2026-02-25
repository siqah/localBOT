import { useState, useRef, useEffect } from 'react';
import {
    Send, Sparkles, FileText, ChevronDown, ChevronUp,
    Loader2, MessageSquare, Brain, Zap, BookOpen, Code,
    Menu, Plus, X, Clock
} from 'lucide-react';
import { api, type ChatResponse, type SourceRef, type ChatSession, type ChatMessage } from '../lib/api';

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

    // Session State
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [historyOpen, setHistoryOpen] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Initial Load: Fetch Sessions
    useEffect(() => {
        loadSessions();
    }, []);

    const loadSessions = async () => {
        try {
            const list = await api.listSessions();
            setSessions(list);
            // If there's an active session, let's just keep it.
            // If there's none, but we have history, load the newest one automatically.
            if (!sessionId && list.length > 0) {
                loadSessionMessages(list[0].id);
            }
        } catch (err) {
            console.error('Failed to load sessions', err);
        }
    };

    const loadSessionMessages = async (id: string) => {
        try {
            setIsLoading(true);
            const history = await api.getSessionMessages(id);

            // Map backend ChatMessage to frontend Message
            const mapped: Message[] = history.map(msg => ({
                id: msg.id,
                role: msg.role === 'system' ? 'assistant' : msg.role,
                content: msg.content,
                sources: msg.sources || undefined,
                timestamp: new Date(msg.created_at)
            }));

            setMessages(mapped);
            setSessionId(id);
            setHistoryOpen(false); // Close drawer on selection
        } catch (err) {
            console.error('Failed to load messages', err);
        } finally {
            setIsLoading(false);
        }
    };

    const startNewChat = () => {
        setSessionId(null);
        setMessages([]);
        setHistoryOpen(false);
    };

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

        const assistantId = `assistant-${Date.now()}`;

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        setMessages(prev => [...prev, {
            id: assistantId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
        }]);

        window.electron.onChatToken((token: string) => {
            setMessages(prev => prev.map(msg =>
                msg.id === assistantId
                    ? { ...msg, content: msg.content + token }
                    : msg
            ));
        });

        try {
            const response: ChatResponse = await api.chat(question, sessionId || undefined);

            // If this was a new session, update the session ID and refresh the list
            if (response.session_id !== sessionId) {
                setSessionId(response.session_id);
                loadSessions();
            }

            setMessages(prev => prev.map(msg =>
                msg.id === assistantId
                    ? { ...msg, content: response.answer, sources: response.sources }
                    : msg
            ));
        } catch (err: any) {
            setMessages(prev => prev.map(msg =>
                msg.id === assistantId
                    ? { ...msg, content: `⚠️ ${err.message || 'Failed to get response.'}` }
                    : msg
            ));
        } finally {
            window.electron.removeChatTokenListeners();
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
        <div className="flex w-full h-full relative overflow-hidden bg-surface-50 dark:bg-surface-950">
            {/* ── Main Chat Area ── */}
            <div className="flex flex-col flex-1 h-full relative z-0 transition-all duration-300">

                {/* Internal Top Bar for Chat Controls */}
                <div className="flex items-center justify-between p-4 pointer-events-none absolute w-full top-0 z-20">
                    <button
                        onClick={() => setHistoryOpen(true)}
                        className="btn-ghost pointer-events-auto bg-white/50 dark:bg-surface-900/50 backdrop-blur-md border border-surface-200 dark:border-surface-700/50 shadow-sm"
                    >
                        <Menu className="w-4 h-4" />
                        <span className="hidden sm:inline">History</span>
                    </button>

                    <button
                        onClick={startNewChat}
                        className="btn-secondary pointer-events-auto bg-white/50 dark:bg-surface-900/50 backdrop-blur-md shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">New Chat</span>
                    </button>
                </div>
                {/* Messages Area */}
                <div className="flex-1 overflow-auto px-4 pt-6 pb-32">
                    {messages.length === 0 ? (
                        /* Empty State */
                        <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto animate-fade-in-up relative">
                            {/* Glow Behind Icon */}
                            <div className="absolute top-0 w-64 h-64 bg-primary-500/20 dark:bg-primary-500/10 blur-[80px] rounded-full animate-blob pointer-events-none" />

                            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-500/20 to-primary-700/10 border border-primary-500/30 flex items-center justify-center mb-8 relative z-10 shadow-xl shadow-primary-500/10">
                                <Brain className="w-12 h-12 text-primary-500 dark:text-primary-400 drop-shadow-md" />
                            </div>
                            <h2 className="text-3xl font-heading font-bold text-surface-900 dark:text-white mb-3">Ask me anything.</h2>
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

                {/* Floating Input Area */}
                <div className="p-6 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-surface-950 dark:via-surface-950/80 absolute bottom-0 w-full left-0 z-10 pointer-events-none">
                    <div className="max-w-3xl mx-auto pointer-events-auto">
                        <div className="glass-card shadow-2xl flex items-end gap-3 p-3 rounded-2xl border border-surface-200 dark:border-surface-700/50">
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

            {/* ── History Drawer Overlay ── */}
            {historyOpen && (
                <div
                    className="absolute inset-0 z-30 bg-surface-900/20 backdrop-blur-sm transition-opacity"
                    onClick={() => setHistoryOpen(false)}
                />
            )}

            {/* ── History Drawer Panel ── */}
            <div className={`absolute top-0 left-0 h-full w-80 bg-white/95 dark:bg-surface-950/95 backdrop-blur-2xl border-r border-surface-200 dark:border-surface-800/50 shadow-2xl transform transition-transform duration-300 z-40 flex flex-col ${historyOpen ? 'translate-x-0' : '-translate-x-full'}`}>

                <div className="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-800/50 flex-shrink-0">
                    <h3 className="font-heading font-bold flex items-center gap-2 text-surface-900 dark:text-white">
                        <Clock className="w-4 h-4 text-primary-500" />
                        Chat History
                    </h3>
                    <button
                        onClick={() => setHistoryOpen(false)}
                        className="btn-ghost p-1.5"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {sessions.length === 0 ? (
                        <div className="text-center p-6 text-surface-500 text-sm">
                            <MessageSquare className="w-8 h-8 text-surface-300 dark:text-surface-700 mx-auto mb-3" />
                            No past sessions found.
                        </div>
                    ) : (
                        sessions.map(session => (
                            <button
                                key={session.id}
                                onClick={() => loadSessionMessages(session.id)}
                                className={`w-full text-left p-3 rounded-xl transition-all ${sessionId === session.id
                                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                                    : 'hover:bg-surface-100 dark:hover:bg-surface-800/50 text-surface-700 dark:text-surface-300'}`}
                            >
                                <div className="line-clamp-2 text-sm leading-snug">{session.title}</div>
                                <div className="text-[10px] mt-2 opacity-60">
                                    {new Date(session.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </button>
                        ))
                    )}
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
                    ? 'bg-gradient-to-br from-primary-600 to-primary-500 text-white shadow-md shadow-primary-500/20 rounded-3xl rounded-tr-sm px-5 py-3.5'
                    : 'glass-card px-5 py-4'
                    }`}>
                    <div className={`prose-content text-sm ${isUser ? 'text-white dark:text-white' : ''}`}>
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
