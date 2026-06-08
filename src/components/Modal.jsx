import React from 'react';
// ─── MODAL UI COMPONENT ───────────────────────────────────────────────────────

function Modal({ isOpen, onClose, title, children, width = 600 }) {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(5, 11, 20, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(6px)',
      padding: 20
    }}>
      <div style={{
        background: '#091629',
        border: '1px solid var(--border)',
        borderRadius: 12,
        width: '100%',
        maxWidth: width,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.02)'
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontFamily: 'Share Tech Mono, monospace', color: 'var(--accent1)' }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 20,
              cursor: 'pointer',
              lineHeight: 1,
              padding: 0
            }}
          >
            &times;
          </button>
        </div>
        <div style={{ padding: 20, flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export default React.memo(Modal);