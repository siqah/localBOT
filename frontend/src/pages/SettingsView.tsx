import { useState, useEffect } from 'react';
import {
    Server, Brain, Database, Search as SearchIcon, Shield,
    Activity, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
    Settings as SettingsIcon, Cpu, HardDrive, Gauge, Info
} from 'lucide-react';
import { api, type HealthStatus, type SystemStats } from '../lib/api';

export default function SettingsView() {
    const [health, setHealth] = useState<HealthStatus | null>(null);
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [systemInfo, setSystemInfo] = useState<{ appData?: string; platform?: string; version?: string } | null>(null);

    // Configuration state
    const [chunkSize, setChunkSize] = useState(500);
    const [chunkOverlap, setChunkOverlap] = useState(50);
    const [systemPrompt, setSystemPrompt] = useState(
        'You are a helpful, private AI assistant. Answer questions based on the provided context from the knowledge base.'
    );

    const loadHealth = async () => {
        setIsLoading(true);
        try {
            const [h, s] = await Promise.all([api.health(), api.stats()]);
            setHealth(h);
            setStats(s);
        } catch {
            setHealth(null);
            setStats(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadHealth();
        // Get system info
        if (window.electron) {
            window.electron.invoke('system:info').then(setSystemInfo).catch(() => { });
        }
    }, []);

    const serviceIcons: Record<string, any> = {
        database: Database,
        redis: Server,
        elasticsearch: SearchIcon,
        localai: Brain,
        opa: Shield,
    };

    const serviceLabels: Record<string, string> = {
        database: 'SQLite Database',
        redis: 'LRU Cache',
        elasticsearch: 'Vector Store',
        localai: 'AI Models',
        opa: 'Security',
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8 animate-fade-in">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
                        <SettingsIcon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        Settings & Status
                    </h1>
                    <p className="text-sm text-surface-500 mt-1">Configure your local AI and monitor services</p>
                </div>
                <button onClick={loadHealth} className="btn-secondary" id="refresh-health">
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                </button>
            </div>

            {/* System Info */}
            {systemInfo && (
                <div className="glass-card p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
                        <Info className="w-5 h-5 text-primary-500 dark:text-primary-400" />
                    </div>
                    <div className="flex-1 flex items-center gap-6 text-sm">
                        <div>
                            <span className="text-surface-500 text-xs">Platform</span>
                            <p className="text-surface-800 dark:text-surface-200 font-medium capitalize">{systemInfo.platform}</p>
                        </div>
                        <div>
                            <span className="text-surface-500 text-xs">Version</span>
                            <p className="text-surface-800 dark:text-surface-200 font-medium">{systemInfo.version}</p>
                        </div>
                        <div className="hidden sm:block">
                            <span className="text-surface-500 text-xs">Data Location</span>
                            <p className="text-surface-800 dark:text-surface-200 font-medium text-xs font-mono truncate max-w-xs">{systemInfo.appData}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* System Health */}
            <section>
                <h2 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    System Health
                </h2>

                {health ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(health.services).map(([name, status]) => {
                            const Icon = serviceIcons[name] || Server;
                            const label = serviceLabels[name] || name;
                            const isUp = status === 'up';
                            return (
                                <div key={name} className="glass-card-hover p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isUp ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20' : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20'
                                                }`}>
                                                <Icon className={`w-5 h-5 ${isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{label}</p>
                                                <p className="text-xs text-surface-500">{isUp ? 'Running' : 'Offline'}</p>
                                            </div>
                                        </div>
                                        {isUp ? (
                                            <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                                        ) : (
                                            <XCircle className="w-5 h-5 text-red-500 dark:text-red-400" />
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Overall Status */}
                        <div className={`glass-card p-4 ${health.status === 'healthy'
                            ? 'border-emerald-300 dark:border-emerald-500/30'
                            : 'border-amber-300 dark:border-amber-500/30'
                            }`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${health.status === 'healthy'
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20'
                                    : 'bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20'
                                    }`}>
                                    <Gauge className={`w-5 h-5 ${health.status === 'healthy' ? 'text-emerald-500 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'
                                        }`} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-surface-800 dark:text-surface-200">Overall Status</p>
                                    <p className={`text-xs font-semibold capitalize ${health.status === 'healthy' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                                        }`}>
                                        {health.status}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="glass-card p-6 text-center">
                        <AlertTriangle className="w-8 h-8 text-amber-500 dark:text-amber-400 mx-auto mb-2" />
                        <p className="text-surface-600 dark:text-surface-400 text-sm">Unable to reach backend services.</p>
                        <p className="text-surface-400 dark:text-surface-600 text-xs mt-1">Run <code className="text-primary-600 dark:text-primary-400">npm run dev</code> to start all services</p>
                    </div>
                )}
            </section>

            {/* System Stats */}
            {stats && (
                <section>
                    <h2 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Cpu className="w-4 h-4" />
                        Knowledge Base Stats
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatPill label="Documents" value={stats.total_documents} icon={HardDrive} />
                        <StatPill label="Chunks" value={stats.total_chunks} icon={Database} />
                        <StatPill label="Sessions" value={stats.total_sessions} icon={Brain} />
                        <StatPill label="Storage" value={formatBytes(stats.storage_bytes)} icon={HardDrive} />
                    </div>
                </section>
            )}

            {/* RAG Configuration */}
            <section>
                <h2 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Brain className="w-4 h-4" />
                    RAG Configuration
                </h2>

                <div className="glass-card p-6 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Chunk Size (words)</label>
                            <input
                                type="number"
                                value={chunkSize}
                                onChange={(e) => setChunkSize(parseInt(e.target.value) || 500)}
                                className="input-field"
                                id="chunk-size"
                            />
                            <p className="text-[11px] text-surface-400 dark:text-surface-600 mt-1">Words per document chunk</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Chunk Overlap (words)</label>
                            <input
                                type="number"
                                value={chunkOverlap}
                                onChange={(e) => setChunkOverlap(parseInt(e.target.value) || 50)}
                                className="input-field"
                                id="chunk-overlap"
                            />
                            <p className="text-[11px] text-surface-400 dark:text-surface-600 mt-1">Overlap between adjacent chunks</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">System Prompt</label>
                        <textarea
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            className="input-field min-h-[100px] resize-y"
                            rows={4}
                            id="system-prompt"
                        />
                        <p className="text-[11px] text-surface-400 dark:text-surface-600 mt-1">Instructions given to the AI before each query</p>
                    </div>

                    <div className="flex justify-end">
                        <button className="btn-primary" id="save-settings">
                            Save Configuration
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );
}

function StatPill({ label, value, icon: Icon }: { label: string; value: number | string; icon: any }) {
    return (
        <div className="glass-card p-3 flex items-center gap-3">
            <Icon className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0" />
            <div>
                <p className="text-lg font-bold text-surface-900 dark:text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
                <p className="text-[10px] text-surface-500">{label}</p>
            </div>
        </div>
    );
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
