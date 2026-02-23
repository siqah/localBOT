import { useState } from 'react';
import { Search, FileText, Loader2, BookOpen, ArrowRight, Layers } from 'lucide-react';
import { api, type SearchResult } from '../lib/api';

export default function KnowledgeView() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setIsSearching(true);
        setHasSearched(true);

        try {
            const hits = await api.search(query);
            setResults(hits);
        } catch {
            setResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch();
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500/20 to-emerald-500/20 border border-primary-500/20 flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-primary-500 dark:text-primary-400" />
                </div>
                <h1 className="text-2xl font-bold text-surface-900 dark:text-white mb-2">Knowledge Explorer</h1>
                <p className="text-surface-500 dark:text-surface-400 max-w-md mx-auto">
                    Search across all your indexed documents using semantic similarity.
                    Find relevant passages even when exact keywords don't match.
                </p>
            </div>

            {/* Search Bar */}
            <div className="glass-card p-2 flex items-center gap-2">
                <Search className="w-5 h-5 text-surface-500 ml-3" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search your knowledge base semantically..."
                    className="flex-1 bg-transparent text-surface-900 dark:text-surface-100 placeholder-surface-400 dark:placeholder-surface-500 border-none outline-none text-sm py-2"
                    id="knowledge-search"
                />
                <button
                    onClick={handleSearch}
                    disabled={!query.trim() || isSearching}
                    className="btn-primary disabled:opacity-30"
                    id="knowledge-search-btn"
                >
                    {isSearching ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <>
                            <span>Search</span>
                            <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </button>
            </div>

            {/* Results */}
            {isSearching ? (
                <div className="flex flex-col items-center py-12 gap-3">
                    <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
                    <p className="text-surface-400 text-sm">Searching knowledge base...</p>
                </div>
            ) : results.length > 0 ? (
                <div className="space-y-3">
                    <p className="text-sm text-surface-500">
                        Found <span className="text-primary-400 font-semibold">{results.length}</span> relevant passages
                    </p>
                    {results.map((result, i) => (
                        <div key={i} className="glass-card-hover p-5 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-primary-400" />
                                    <span className="text-sm font-medium text-surface-800 dark:text-surface-200">{result.document_name}</span>
                                    <span className="badge-neutral">Chunk #{result.chunk_index + 1}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-20 bg-surface-200 dark:bg-surface-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-primary-500 to-emerald-500 rounded-full transition-all"
                                            style={{ width: `${Math.min(result.score * 100, 100)}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-surface-500 font-mono">
                                        {(result.score * 100).toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                            <p className="text-sm text-surface-400 leading-relaxed">
                                {result.chunk_content}
                            </p>
                        </div>
                    ))}
                </div>
            ) : hasSearched ? (
                <div className="glass-card p-12 text-center">
                    <Layers className="w-10 h-10 text-surface-600 mx-auto mb-3" />
                    <p className="text-surface-400">No results found. Try a different query or upload more documents.</p>
                </div>
            ) : null}
        </div>
    );
}
