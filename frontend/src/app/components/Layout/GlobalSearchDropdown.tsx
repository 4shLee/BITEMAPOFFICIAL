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
  CornerDownLeft,
} from 'lucide-react';
import { searchAPI, type GlobalSearchResultItem } from '../../../lib/services/api';

interface FlattenedItem {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  url: string;
  icon: React.ReactNode;
}

export function GlobalSearchDropdown() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
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

  // Global Ctrl+K / Cmd+K shortcut listener to focus and open
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);

    return () => clearTimeout(handler);
  }, [query]);

  // Fetch search results from backend
  useEffect(() => {
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
  }, [debouncedQuery]);

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
    setIsOpen(false);
    navigate(item.url);
  };

  // Keyboard navigation inside input/dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

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
      setIsOpen(false);
      inputRef.current?.blur();
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

  const hasResults = flattenedItems.length > 0;

  // Group items by category for rendering
  const groupedCategories = flattenedItems.reduce<Record<string, FlattenedItem[]>>((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div ref={containerRef} className="relative w-full max-w-xl lg:max-w-2xl">
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search BITEMAP (patients, bite incidents, schedules, inventory...)"
          className="h-10 w-full rounded-full border border-input bg-input-background pl-10 pr-24 text-sm shadow-xs transition-all placeholder:text-muted-foreground/80 focus:border-primary/60 focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          )}

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          <kbd className="pointer-events-none hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted/80 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-[9px]">Ctrl</span>K
          </kbd>
        </div>
      </div>

      {/* Dropdown Menu (NOT modal, attached directly underneath the search bar) */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-[1050] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-slate-900/15 ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-100">
          <div
            ref={listRef}
            className="max-h-[460px] overflow-y-auto p-2 scroll-smooth divide-y divide-border/40"
          >
            {isLoading && !hasResults && (
              <div className="py-10 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Searching database...</p>
              </div>
            )}

            {!isLoading && debouncedQuery && !hasResults && (
              <div className="py-10 text-center px-4">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
                  <Search className="h-4 w-4" />
                </div>
                <p className="text-sm font-semibold text-foreground">No matches found</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  No records match &ldquo;{debouncedQuery}&rdquo;. Try another name, case code, or inventory item.
                </p>
              </div>
            )}

            {hasResults &&
              Object.entries(groupedCategories).map(([category, items]) => (
                <div key={category} className="py-2 first:pt-1 last:pb-1">
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
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all ${
                            isSelected
                              ? 'bg-primary/10 text-primary-dark font-medium shadow-2xs'
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
                            <p className="text-sm font-semibold truncate leading-snug">
                              {item.title}
                            </p>
                            {item.subtitle && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {item.subtitle}
                              </p>
                            )}
                          </div>
                          {isSelected ? (
                            <div className="flex items-center gap-1 text-primary text-xs font-semibold shrink-0">
                              <span className="hidden sm:inline">Go</span>
                              <CornerDownLeft className="h-3.5 w-3.5" />
                            </div>
                          ) : (
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>

          {/* Bottom subtle shortcut hints */}
          <div className="flex items-center justify-between border-t border-border/60 bg-muted/30 px-3.5 py-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[9px]">↑↓</kbd>
                <span>navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[9px]">↵</kbd>
                <span>select</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-background px-1 py-0.5 font-mono text-[9px]">esc</kbd>
                <span>close</span>
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground/75 font-medium">
              Global Search
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
