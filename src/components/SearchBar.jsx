import { useState, useEffect } from 'react';
import { useDebounce } from '../hooks/useDebounce.js';

/**
 * SearchBar Component
 * Provides a real-time search input with debouncing and accessibility features
 */
export function SearchBar({
  value = '',
  onChange = () => {},
  onClear = () => {},
  placeholder = 'Search tasks...',
  disabled = false,
  ariaLabel = 'Search tasks by keyword or description',
}) {
  const [queryInput, setQueryInput] = useState(value);
  const debouncedQuery = useDebounce(queryInput, 500);

  // Notify parent when debounced query changes
  useEffect(() => {
    onChange(debouncedQuery);
  }, [debouncedQuery, onChange]);

  const handleInputChange = (event) => {
    setQueryInput(event.target.value);
  };

  const handleClear = () => {
    setQueryInput('');
    onClear();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      handleClear();
    }
  };

  return (
    <div className="search-bar" role="search">
      <label htmlFor="search-input" className="search-label">
        Search
      </label>
      <div className="search-input-wrapper">
        <input
          id="search-input"
          type="text"
          className="search-input"
          placeholder={placeholder}
          value={queryInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-describedby="search-hint"
        />
        {queryInput && (
          <button
            type="button"
            className="search-clear-button"
            onClick={handleClear}
            disabled={disabled}
            aria-label="Clear search"
            title="Clear search (Esc)"
          >
            ×
          </button>
        )}
      </div>
      <p id="search-hint" className="search-hint">
        Results update as you type
      </p>
    </div>
  );
}

export default SearchBar;
