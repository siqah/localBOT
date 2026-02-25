import { useState, useCallback, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
    MessageSquare, FileText, Search, Settings, Brain,
    Moon, Sun, Menu, X, Zap, Leaf
} from 'lucide-react';
import ChatView from './pages/ChatView';
import DocumentsView from './pages/DocumentsView';
import KnowledgeView from './pages/KnowledgeView';
import SettingsView from './pages/SettingsView';

function AppContent() {
    const [darkMode, setDarkMode] = useState(() => {
        // Persist theme preference
        const saved = localStorage.getItem('localbot-theme');
        if (saved) return saved === 'dark';
        return true; // default to dark
    });
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const location = useLocation();

    useEffect(() => {
        document.documentElement.classList.toggle('dark', darkMode);
        localStorage.setItem('localbot-theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

    const toggleDarkMode = useCallback(() => {
        setDarkMode(prev => !prev);
    }, []);

    const navItems = [
        { to: '/', icon: MessageSquare, label: 'Chat', description: 'Ask questions' },
        { to: '/documents', icon: FileText, label: 'Documents', description: 'Manage files' },
        { to: '/knowledge', icon: Search, label: 'Knowledge', description: 'Browse & search' },
        { to: '/settings', icon: Settings, label: 'Settings', description: 'Configure' },
    ];

    return (
        <div className="flex h-screen overflow-hidden bg-surface-50 dark:bg-surface-950 transition-colors duration-300">
            {/* ── Sidebar ────────────────────── */}
            <aside className={`w-64 flex-shrink-0 transition-all duration-300 flex flex-col border-r border-surface-200 dark:border-surface-800/50 bg-white dark:bg-surface-950/90 backdrop-blur-xl ${sidebarOpen ? 'ml-0' : '-ml-64'}`}>
                {/* Logo */}
                <div className="p-5 border-b border-surface-200 dark:border-surface-800/50">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/20">
                                <Brain className="w-5 h-5 text-white" />
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-surface-950" />
                        </div>
                        <div>
                            <h1 className="text-xl font-heading font-bold text-surface-900 dark:text-white tracking-tight">LocalBOT</h1>
                            <p className="text-[11px] text-surface-500 font-medium">Private AI Assistant</p>
                        </div>
                    </div>
                </div>

                {/* Privacy Badge */}
                <div className="mx-4 mt-4 p-3 glass-card flex items-center gap-2.5">
                    <Leaf className="w-4 h-4 text-primary-500 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-semibold text-primary-600 dark:text-primary-400">100% Offline</p>
                        <p className="text-[10px] text-surface-500">All data stays local</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-3 mt-2 space-y-1">
                    {navItems.map(item => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                        >
                            <item.icon className="w-[18px] h-[18px]" />
                            <div>
                                <span className="block">{item.label}</span>
                                <span className="block text-[10px] text-surface-400 dark:text-surface-500 font-normal">{item.description}</span>
                            </div>
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-surface-200 dark:border-surface-800/50 space-y-3">
                    <button onClick={toggleDarkMode} className="btn-ghost w-full justify-center">
                        {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-surface-600" />}
                        <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
                    </button>
                    <div className="flex items-center justify-center gap-2 text-[10px] text-surface-400 dark:text-surface-600">
                        <Zap className="w-3 h-3" />
                        <span>Powered by LocalAI</span>
                    </div>
                </div>
            </aside>

            {/* ── Main Content ──────────────── */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Top Bar */}
                <header className="h-14 flex items-center px-4 border-b border-surface-200 dark:border-surface-800/50 bg-white/80 dark:bg-surface-950/80 backdrop-blur-xl shrink-0">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="btn-ghost mr-3 p-2 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-800 transition-colors"
                        aria-label="Toggle Sidebar"
                    >
                        {sidebarOpen ? <X className="w-5 h-5 text-surface-600 dark:text-surface-400" /> : <Menu className="w-5 h-5 text-surface-900 dark:text-white" />}
                    </button>

                    <div className="flex items-center gap-2">
                        {navItems.find(n => n.to === location.pathname)?.icon &&
                            (() => {
                                const Icon = navItems.find(n => n.to === location.pathname)?.icon || MessageSquare;
                                return <Icon className="w-4 h-4 text-primary-600 dark:text-primary-400" />;
                            })()
                        }
                        <h2 className="text-sm font-heading font-semibold text-surface-800 dark:text-surface-200">
                            {navItems.find(n => n.to === location.pathname)?.label || 'LocalBOT'}
                        </h2>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                        <StatusIndicator />
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 overflow-auto bg-surface-50 dark:bg-surface-950 transition-colors duration-300">
                    <Routes>
                        <Route path="/" element={<ChatView />} />
                        <Route path="/documents" element={<DocumentsView />} />
                        <Route path="/knowledge" element={<KnowledgeView />} />
                        <Route path="/settings" element={<SettingsView />} />
                    </Routes>
                </div>
            </main>
        </div>
    );
}

function StatusIndicator() {
    const [status] = useState<'online' | 'degraded' | 'offline'>('online');

    const colors = {
        online: 'bg-primary-500',
        degraded: 'bg-amber-500',
        offline: 'bg-red-500',
    };

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 glass-card">
            <div className={`w-2 h-2 rounded-full ${colors[status]} animate-pulse-subtle`} />
            <span className="text-xs text-surface-600 dark:text-surface-400 capitalize">{status}</span>
        </div>
    );
}

export default function App() {
    return (
        <HashRouter>
            <AppContent />
        </HashRouter>
    );
}
