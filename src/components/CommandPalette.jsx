import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useUI } from '../context/UIContext';
import { useNavigate } from 'react-router-dom';

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const { data } = useData();
  const { setActiveNav } = useUI();
  const navigate = useNavigate();

  // Navigation Options
  const navOptions = [
    { type: 'Page', title: 'Go to Overview', path: '/', nav: 'overview', icon: '🏠' },
    { type: 'Page', title: 'Go to PO Tracker', path: '/tracking', nav: 'tracking', icon: '📊' },
    { type: 'Page', title: 'Go to Data Upload', path: '/upload', nav: 'upload', icon: '📤' },
    { type: 'Page', title: 'Go to Users & Access', path: '/users', nav: 'users', icon: '👥' },
  ];

  // Global search filtering
  const filteredNav = navOptions.filter(o => o.title.toLowerCase().includes(query.toLowerCase()));
  
  // Search through POs or SCs in live data
  // Limit to top 5 results to prevent massive rendering
  const filteredData = query.length > 1 
    ? data.filter(d => 
        (d.po && d.po.toLowerCase().includes(query.toLowerCase())) ||
        (d.sc && d.sc.toLowerCase().includes(query.toLowerCase())) ||
        (d.product && d.product.toLowerCase().includes(query.toLowerCase()))
      ).slice(0, 5).map(d => ({
        type: 'Record',
        title: `${d.po} - ${d.sc}`,
        subtitle: `Stage: ${d.currentStage} | ${d.product}`,
        path: '/tracking',
        nav: 'tracking',
        icon: '📄'
      }))
    : [];

  const results = [...filteredNav, ...filteredData];

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % results.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          executeCommand(results[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  const executeCommand = (item) => {
    setActiveNav(item.nav);
    navigate(item.path);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={e => e.stopPropagation()}>
        <input 
          ref={inputRef}
          type="text" 
          className="command-palette-input"
          placeholder="Search for POs, SCs, or navigate to pages..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        
        <div className="command-palette-results">
          {results.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No results found for "{query}"
            </div>
          ) : (
            results.map((item, idx) => (
              <div 
                key={idx}
                className={`command-item ${idx === selectedIndex ? 'selected' : ''}`}
                onClick={() => executeCommand(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div style={{ fontSize: '20px' }}>{item.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600' }}>
                    {item.title}
                  </div>
                  {item.subtitle && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px', fontFamily: 'Share Tech Mono' }}>
                      {item.subtitle}
                    </div>
                  )}
                </div>
                <div className="command-kbd">{item.type}</div>
              </div>
            ))
          )}
        </div>
        
        <div style={{ 
          padding: '8px 16px', 
          borderTop: '1px solid var(--border)', 
          background: 'var(--bg-secondary)',
          display: 'flex',
          gap: '12px',
          fontSize: '11px',
          color: 'var(--text-muted)'
        }}>
          <span><kbd className="command-kbd">↑</kbd> <kbd className="command-kbd">↓</kbd> to navigate</span>
          <span><kbd className="command-kbd">Enter</kbd> to select</span>
          <span><kbd className="command-kbd">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}
