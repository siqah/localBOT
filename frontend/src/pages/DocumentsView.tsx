import { useState, useCallback, useEffect } from 'react';
import {
    Upload, FileText, Trash2, Search, RefreshCw, AlertTriangle,
    CheckCircle2, Clock, Loader2, File, FileType, FileCode,
    HardDrive, Layers
} from 'lucide-react';
import { api, type Document } from '../lib/api';

export default function DocumentsView() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const loadDocuments = useCallback(async () => {
        try {
            setIsLoading(true);
            const docs = await api.listDocuments();
            setDocuments(docs);
        } catch {
            setDocuments([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { loadDocuments(); }, [loadDocuments]);

    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setIsUploading(true);

        for (const file of Array.from(files)) {
            try {
                await api.uploadDocument(file);
            } catch (err) {
                console.error('Upload failed:', err);
            }
        }

        setIsUploading(false);
        loadDocuments();
    };

    const handleDelete = async (id: string) => {
        try {
            await api.deleteDocument(id);
            setDocuments(prev => prev.filter(d => d.id !== id));
            setDeleteConfirm(null);
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        handleUpload(e.dataTransfer.files);
    }, []);

    const filteredDocs = documents.filter(d =>
        d.filename.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalSize = documents.reduce((sum, d) => sum + d.size_bytes, 0);
    const totalChunks = documents.reduce((sum, d) => sum + d.chunk_count, 0);

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
            {/* Header Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    icon={FileText}
                    label="Documents"
                    value={documents.length.toString()}
                    color="primary"
                />
                <StatCard
                    icon={Layers}
                    label="Total Chunks"
                    value={totalChunks.toLocaleString()}
                    color="emerald"
                />
                <StatCard
                    icon={HardDrive}
                    label="Storage Used"
                    value={formatBytes(totalSize)}
                    color="amber"
                />
            </div>

            {/* Upload Zone */}
            <div
                className={`upload-zone ${dragOver ? 'dragover' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input')?.click()}
                id="upload-zone"
            >
                <input
                    id="file-input"
                    type="file"
                    multiple
                    accept=".pdf,.txt,.md,.docx,.doc,.csv,.json,.yaml,.yml,.html,.htm,.xml"
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files)}
                />
                {isUploading ? (
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 text-primary-500 dark:text-primary-400 animate-spin" />
                        <p className="text-surface-600 dark:text-surface-300 font-medium">Uploading & processing...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-[2rem] bg-gradient-to-br from-primary-500/20 to-primary-700/10 border border-primary-500/30 flex items-center justify-center shadow-lg shadow-primary-500/10">
                            <Upload className="w-8 h-8 text-primary-500 dark:text-primary-400" />
                        </div>
                        <div>
                            <p className="text-xl font-heading text-surface-900 dark:text-white font-bold tracking-tight">Drop files here or click to upload</p>
                            <p className="text-sm text-surface-500 mt-2 font-medium">
                                Supports PDF, TXT, MD, DOCX, CSV, JSON, YAML, HTML, XML
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Search & Actions */}
            <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search documents..."
                        className="input-field pl-10"
                        id="doc-search"
                    />
                </div>
                <button onClick={loadDocuments} className="btn-secondary">
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                </button>
            </div>

            {/* Document List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
                </div>
            ) : filteredDocs.length === 0 ? (
                <div className="glass-card p-12 text-center animate-fade-in-up">
                    <FileText className="w-10 h-10 text-surface-600 mx-auto mb-3" />
                    <p className="text-surface-400">
                        {searchQuery ? 'No documents match your search' : 'No documents yet — upload some files to get started'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredDocs.map((doc, i) => (
                        <div key={doc.id} className="glass-card-hover p-4 flex items-center gap-4 animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
                            <div className="w-10 h-10 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center flex-shrink-0">
                                <FileIcon contentType={doc.content_type} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">{doc.filename}</p>
                                <div className="flex items-center gap-3 mt-1">
                                    <span className="text-[11px] text-surface-500">{formatBytes(doc.size_bytes)}</span>
                                    <span className="text-[11px] text-surface-500">{doc.chunk_count} chunks</span>
                                    <span className="text-[11px] text-surface-600">
                                        {new Date(doc.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            <StatusBadge status={doc.status} />

                            {deleteConfirm === doc.id ? (
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleDelete(doc.id)} className="btn-danger text-xs px-3 py-1.5">
                                        Confirm
                                    </button>
                                    <button onClick={() => setDeleteConfirm(null)} className="btn-ghost text-xs px-3 py-1.5">
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setDeleteConfirm(doc.id)}
                                    className="btn-ghost text-surface-500 hover:text-red-400"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Sub-components ──────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
    icon: any; label: string; value: string; color: string;
}) {
    const colorMap: Record<string, string> = {
        primary: 'from-primary-500/10 to-primary-500/5 border-primary-500/20 text-primary-400',
        emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
        amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-400',
    };

    return (
        <div className={`glass-card p-4 bg-gradient-to-br ${colorMap[color]}`}>
            <div className="flex items-center gap-3">
                <Icon className="w-5 h-5" />
                <div>
                    <p className="text-2xl font-bold text-surface-900 dark:text-white">{value}</p>
                    <p className="text-xs text-surface-500">{label}</p>
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { class: string; icon: any; label: string }> = {
        indexed: { class: 'badge-success', icon: CheckCircle2, label: 'Indexed' },
        processing: { class: 'badge-warning', icon: Loader2, label: 'Processing' },
        pending: { class: 'badge-info', icon: Clock, label: 'Pending' },
        error: { class: 'badge-error', icon: AlertTriangle, label: 'Error' },
    };

    const c = config[status] || config.pending;
    const Icon = c.icon;

    return (
        <span className={c.class}>
            <Icon className={`w-3 h-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
            {c.label}
        </span>
    );
}

function FileIcon({ contentType }: { contentType: string }) {
    if (contentType.includes('pdf')) return <FileType className="w-5 h-5 text-red-400" />;
    if (contentType.includes('markdown')) return <FileCode className="w-5 h-5 text-blue-400" />;
    if (contentType.includes('json') || contentType.includes('yaml')) return <FileCode className="w-5 h-5 text-amber-400" />;
    return <File className="w-5 h-5 text-surface-400" />;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
