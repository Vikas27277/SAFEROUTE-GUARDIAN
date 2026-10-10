import React, { useState, useEffect, useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { geocode } from '../lib/geocode';

export default function PlaceInput({ placeholder, value, onChange }) {
  const [query, setQuery] = useState(value?.label || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const reqIdRef = useRef(0);
  const inputRef = useRef(null);
  const selectedRef = useRef(Boolean(value));
  const listboxId = `places-${useId().replaceAll(':', '')}`;

  useEffect(() => {
    if (value) {
      selectedRef.current = true;
      setQuery(value.label);
    } else {
      selectedRef.current = false;
    }
  }, [value]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2 || selectedRef.current) {
      reqIdRef.current += 1;
      setSuggestions([]);
      setErrorMessage('');
      setIsLoading(false);
      return undefined;
    }
    
    const requestId = ++reqIdRef.current;
    const controller = new AbortController();
    setIsLoading(true);
    setErrorMessage('');
    setSuggestions([]);
    setSelectedIndex(-1);
    
    const timeout = setTimeout(async () => {
      try {
        const results = await geocode(trimmedQuery, { signal: controller.signal });
        if (requestId === reqIdRef.current) {
          setSuggestions(results);
          setIsLoading(false);
        }
      } catch (error) {
        if (requestId === reqIdRef.current && error.name !== 'AbortError') {
          setSuggestions([]);
          setErrorMessage(error.message || 'Place search failed. Please try again.');
          setIsLoading(false);
        }
      }
    }, 300);
    
    return () => {
      clearTimeout(timeout);
      controller.abort();
      if (requestId === reqIdRef.current) reqIdRef.current += 1;
    };
  }, [query]);

  useLayoutEffect(() => {
    if (!showDropdown || !inputRef.current) return undefined;

    const updatePosition = () => {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const availableBelow = Math.max(0, viewportHeight - rect.bottom - 8);
      const availableAbove = Math.max(0, rect.top - 8);
      const placeAbove = availableBelow < 160 && availableAbove > availableBelow;
      const maxHeight = Math.min(240, placeAbove ? availableAbove : availableBelow);
      const width = Math.min(rect.width, window.innerWidth - 16);
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      const dropdown = document.getElementById(listboxId);
      if (dropdown) {
        dropdown.style.left = `${left}px`;
        dropdown.style.width = `${width}px`;
        dropdown.style.maxHeight = `${maxHeight}px`;
        dropdown.style.top = `${placeAbove ? rect.top - maxHeight - 4 : rect.bottom + 4}px`;
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    window.visualViewport?.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('scroll', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.visualViewport?.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('scroll', updatePosition);
    };
  }, [showDropdown, listboxId]);

  const handleSelect = (s) => {
    reqIdRef.current += 1;
    selectedRef.current = true;
    setQuery(s.label);
    setSuggestions([]);
    setShowDropdown(false);
    setIsLoading(false);
    setErrorMessage('');
    onChange(s);
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setShowDropdown(false);
      return;
    }
    if (!showDropdown || suggestions.length === 0) return;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex >= 0 ? selectedIndex : 0]);
    }
  };

  const dropdown = showDropdown && query.trim().length >= 2 && createPortal(
    <ul
      id={listboxId}
      role="listbox"
      aria-label={`${placeholder} suggestions`}
      className="fixed z-[1000] bg-[var(--color-sr-elevated)] backdrop-blur-md border border-[var(--color-sr-border)] max-h-60 overflow-y-auto rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] custom-scrollbar"
      style={{ left: 8, top: 8, width: inputRef.current?.getBoundingClientRect().width || 240 }}
    >
      {isLoading ? (
        <li role="status" className="p-4 text-sm text-[var(--color-sr-text-secondary)]">Searching places...</li>
      ) : errorMessage ? (
        <li role="alert" className="p-4 text-sm text-red-400">{errorMessage}</li>
      ) : suggestions.length === 0 ? (
        <li role="status" className="p-4 text-sm text-[var(--color-sr-text-muted)]">No places found. Try another spelling.</li>
      ) : suggestions.map((s, i) => (
        <li key={`${s.coords.join(',')}-${s.label}`} role="option" aria-selected={i === selectedIndex}>
          <button
            id={`${listboxId}-option-${i}`}
            type="button"
            className={`w-full p-3.5 text-left text-sm transition-colors border-b border-[var(--color-sr-border)] last:border-0 ${i === selectedIndex ? 'bg-[var(--color-sr-border)] text-[var(--color-sr-accent-light)]' : 'hover:bg-[var(--color-sr-border)] text-[var(--color-sr-text-primary)]'}`}
            onPointerDown={e => e.preventDefault()}
            onClick={() => handleSelect(s)}
            onMouseEnter={() => setSelectedIndex(i)}
          >
            <span className="block font-semibold">{s.name || s.label}</span>
            {s.address && s.address !== (s.name || s.label) && (
              <span className="mt-1 block text-xs text-[var(--color-sr-text-muted)]">{s.address}</span>
            )}
          </button>
        </li>
      ))}
    </ul>,
    document.body
  );

  return (
    <div className="relative text-gray-200">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-activedescendant={selectedIndex >= 0 ? `${listboxId}-option-${selectedIndex}` : undefined}
          className="w-full p-3 rounded-xl premium-input text-sm pr-10"
          value={query}
          onKeyDown={handleKeyDown}
          onChange={(e) => {
            selectedRef.current = false;
            setQuery(e.target.value);
            setShowDropdown(true);
            setSelectedIndex(-1);
            onChange(null);
          }}
          onFocus={() => {
            if (query.trim().length >= 2 && !selectedRef.current) setShowDropdown(true);
          }}
          onBlur={() => setShowDropdown(false)}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-5 w-5 text-[var(--color-sr-accent)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
      </div>
      {dropdown}
    </div>
  );
}
