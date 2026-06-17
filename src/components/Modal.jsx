import React from 'react';
// ─── MODAL UI COMPONENT ───────────────────────────────────────────────────────

function Modal({ isOpen, onClose, title, children, maxWidth = '600px', lightMode = false }) {
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 11, 20, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(6px)',
        padding: 20,
      }}
    >
      <div
        style={{
          background: lightMode ? '#ffffff' : '#091629',
          border: lightMode ? '1px solid #e2e8f0' : '1px solid var(--border)',
          borderRadius: 12,
          width: '100%',
          maxWidth: maxWidth,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: lightMode ? '#f8fafc' : 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontFamily: 'Share Tech Mono, monospace',
              color: lightMode ? '#0f172a' : 'var(--accent1)',
            }}
          >
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: lightMode ? '#64748b' : 'var(--text-muted)',
              fontSize: 20,
              cursor: 'pointer',
              lineHeight: 1,
              padding: 0,
            }}
          >
            &times;
          </button>
        </div>
        <div style={{ padding: 20, flex: 1, color: lightMode ? '#334155' : 'inherit' }}>{children}</div>
      </div>
    </div>
  );
}

export default React.memo(Modal);
