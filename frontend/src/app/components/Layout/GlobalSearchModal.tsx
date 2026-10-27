import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Search,
  X,
  Loader2,
  User,
  AlertCircle,
  Syringe,
  Package,
  Shield,
  Compass,
  ArrowRight,
  ExternalLink,
  CornerDownLeft,
} from 'lucide-react';
import { searchAPI, type GlobalSearchResultItem } from '../../../lib/services/api';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FlattenedItem {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  url: string;
  icon: React.ReactNode;
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [results, setResults] = useState<{
    patients: GlobalSearchResultItem[];
    incidents: GlobalSearchResultItem[];
    pep_schedules: GlobalSearchResultItem[];
    inventory: GlobalSearchResultItem[];
    users: GlobalSearchResultItem[];
    navigation: GlobalSearchResultItem[];
  }>({
    patients: [],
    incidents: [],
    pep_schedules: [],
    inventory: [],
    users: [],
    navigation: [],
  });

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } else {
      setQuery('');
      setDebouncedQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);

    return () => clearTimeout(handler);
  }, [query]);

  // Fetch search results
  useEffect(() => {
    if (!isOpen) return;

    if (!debouncedQuery) {
      setResults({
        patients: [],
        incidents: [],
        pep_schedules: [],
        inventory: [],
        users: [],
        navigation: [],
      });
      setIsLoading(false);
      setSelectedIndex(0);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);

    searchAPI
      .globalSearch(debouncedQuery, controller.signal)
      .then((res) => {
        if (res && res.success && res.data) {
          setResults(res.data);
          setSelectedIndex(0);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Search error:', err);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQuery, isOpen]);

  // Flatten results for keyboard navigation
  const flattenedItems = useMemo<FlattenedItem[]>(() => {
    const items: FlattenedItem[] = [];

    // If query is empty, show default quick navigation items
    if (!debouncedQuery) {
      const defaultNav: FlattenedItem[] = [
        {
          id: 'def-dash',
          category: 'Quick Links',
          title: 'Dashboard Overview',
          subtitle: 'Go to main clinic operational overview and stats',
          url: '/dashboard',
          icon: <Compass className="w-4 h-4 text-emerald-600" />,
        },
        {
          id: 'def-pat',
          category: 'Quick Links',
          title: 'Patient Registry',
          subtitle: 'Browse and search all patient records',
          url: '/patients',
          icon: <User className="w-4 h-4 text-blue-600" />,
        },
        {
          id: 'def-inc-new',
          category: 'Quick Links',
          title: 'Log New Incident Report',
          subtitle: 'Create a new animal bite incident entry',
          url: '/incidents/new',
          icon: <AlertCircle className="w-4 h-4 text-amber-600" />,
        },
        {
          id: 'def-pep',
          category: 'Quick Links',
          title: 'PEP Schedule Management',
          subtitle: 'View vaccination appointments and pending doses',
          url: '/pep-schedule',
          icon: <Syringe className="w-4 h-4 text-teal-600" />,
        },
        {
          id: 'def-inv',
          category: 'Quick Links',
          title: 'Vaccine & Supply Inventory',
          subtitle: 'Monitor stock levels, batches, and reorders',
          url: '/inventory',
          icon: <Package className="w-4 h-4 text-indigo-600" />,
        },
        {
          id: 'def-gis',
          category: 'Quick Links',
          title: 'GIS Heatmap & Map',
          subtitle: 'View high-risk barangays and spatial bite map',
          url: '/gis-map',
          icon: <Compass className="w-4 h-4 text-rose-600" />,
        },
      ];
      return defaultNav;
    }

    // 1. Patients
    results.patients.forEach((p, idx) => {
      items.push({
        id: `pat-${p.id || idx}`,
        category: 'Patients',
        title: p.title,
        subtitle: p.subtitle,
        url: p.url,
        icon: <User className="w-4 h-4 text-blue-600" />,
      });
    });

    // 2. Bite Incidents
    results.incidents.forEach((inc, idx) => {
      items.push({
        id: `inc-${inc.id || idx}`,
        category: 'Bite Incidents',
        title: inc.title,
        subtitle: inc.subtitle,
        url: inc.url,
        icon: <AlertCircle className="w-4 h-4 text-amber-600" />,
      });
    });

    // 3. PEP Schedules
    results.pep_schedules.forEach((sched, idx) => {
      items.push({
        id: `sched-${sched.id || idx}`,
        category: 'PEP Schedules',
        title: sched.title,
        subtitle: sched.subtitle,
        url: sched.url,
        icon: <Syringe className="w-4 h-4 text-teal-600" />,
      });
    });

    // 4. Inventory
    results.inventory.forEach((inv, idx) => {
      items.push({
        id: `inv-${inv.id || idx}`,
        category: 'Inventory',
        title: inv.title,
        subtitle: inv.subtitle,
        url: inv.url,
        icon: <Package className="w-4 h-4 text-indigo-600" />,
      });
    });

    // 5. Users
    if (results.users && results.users.length > 0) {
      results.users.forEach((u, idx) => {
        items.push({
          id: `usr-${u.id || idx}`,
          category: 'Users',
          title: u.title,
          subtitle: u.subtitle,
          url: u.url,
          icon: <Shield className="w-4 h-4 text-purple-600" />,
        });
      });
    }

    // 6. Navigation
    results.navigation.forEach((nav, idx) => {
      items.push({
        id: `nav-${idx}`,
        category: 'Navigation',
        title: nav.title,
        subtitle: nav.subtitle,
        url: nav.url,
        icon: <Compass className="w-4 h-4 text-emerald-600" />,
      });
    });

    return items;
  }, [debouncedQuery, results]);

  const handleSelectItem = (item: FlattenedItem) => {
    onClose();
    navigate(item.url);
  };

  // Keyboard navigation inside modal
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < flattenedItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flattenedItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flattenedItems[selectedIndex]) {
        handleSelectItem(flattenedItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Auto scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  const totalResultsCount = flattenedItems.length;
  const hasResults = totalResultsCount > 0;

  // Group items by category for rendering
  const groupedCategories = flattenedItems.reduce<Record<string, FlattenedItem[]>>((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center pt-14 sm:pt-20 px-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl shadow-slate-950/20 ring-1 ring-black/5 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center border-b border-border/70 px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search patients, bite incidents, schedules, inventory..."
            className="flex-1 bg-transparent text-sm sm:text-base font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-primary mr-2 shrink-0" />
          )}
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mr-1"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Results List Area */}
        <div
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto p-2 scroll-smooth"
        >
          {isLoading && !hasResults && (
            <div className="py-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Searching BITEMAP database...</p>
            </div>
          )}

          {!isLoading && debouncedQuery && !hasResults && (
            <div className="py-12 text-center px-4">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
                <Search className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-foreground">No matches found</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                No patient, incident, schedule, or inventory record matches &ldquo;{debouncedQuery}&rdquo;. Check spelling or search inside the specific module.
              </p>
            </div>
          )}

          {hasResults && (
            <div className="space-y-4 py-1">
              {Object.entries(groupedCategories).map(([category, items]) => (
                <div key={category}>
                  <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    {category}
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {items.map((item) => {
                      const overallIndex = flattenedItems.findIndex((fi) => fi.id === item.id);
                      const isSelected = overallIndex === selectedIndex;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-index={overallIndex}
                          onClick={() => handleSelectItem(item)}
                          onMouseEnter={() => setSelectedIndex(overallIndex)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                            isSelected
                              ? 'bg-primary/10 text-primary-dark font-medium shadow-xs'
                              : 'hover:bg-muted/60 text-foreground'
                          }`}
                        >
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                              isSelected
                                ? 'bg-primary/20 border-primary/30'
                                : 'bg-muted/80 border-border/60'
                            }`}
                          >
                            {item.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold truncate leading-snug">
                                {item.title}
                              </p>
                            </div>
                            {item.subtitle && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {item.subtitle}
                              </p>
                            )}
                          </div>
                          {isSelected ? (
                            <div className="flex items-center gap-1 text-primary text-xs font-semibold shrink-0">
                              <span className="hidden sm:inline">Open</span>
                              <CornerDownLeft className="h-3.5 w-3.5" />
                            </div>
                          ) : (
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">↑</kbd>
              <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">↓</kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">↵</kbd>
              <span>select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[10px]">esc</kbd>
              <span>close</span>
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground/80 font-medium">
            BITEMAP Global Search
          </span>
        </div>
      </div>
    </div>
  );
}
