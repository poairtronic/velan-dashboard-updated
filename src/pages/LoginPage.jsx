import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { logger } from '../utils/logger';
import { apiClient } from '../services/apiClient';

function IconShield({ size = 16 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3z" />
    </svg>
  );
}
function IconUser({ size = 16 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  );
}
function IconEye({ size = 18 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M12 5c-7 0-11 7-11 7s4 7 11 7 11-7 11-7-4-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function IconEyeOff({ size = 18 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.06 3.94" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
function IconShieldCheck({ size = 64 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
function IconView({ size = 64 }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5c-7 0-11 7-11 7s4 7 11 7 11-7 11-7-4-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0b1120',
    padding: 20,
  },
  card: {
    display: 'flex',
    width: 820,
    maxWidth: '100%',
    minHeight: 520,
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  left: {
    flex: 1,
    background: '#fff',
    padding: '44px 40px 36px',
    display: 'flex',
    flexDirection: 'column',
  },
  right: {
    flex: 1,
    background: '#4B3ADB',
    padding: '44px 36px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 28,
  },
  logoMark: {
    width: 38,
    height: 38,
    background: 'linear-gradient(135deg, #7c5cfc, #4B3ADB)',
    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: 13,
    color: '#fff',
    fontFamily: "'Rajdhani', sans-serif",
    flexShrink: 0,
  },
  logoText: {
    fontFamily: "'Rajdhani', sans-serif",
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: 2,
    color: '#4B3ADB',
    lineHeight: 1.1,
  },
  logoSub: {
    fontSize: 8,
    letterSpacing: 3,
    color: '#8b7cf0',
    fontFamily: "'Share Tech Mono', monospace",
  },
  roleToggle: {
    display: 'flex',
    gap: 8,
    marginBottom: 20,
    background: '#f3f4f6',
    borderRadius: 8,
    padding: 3,
  },
  roleBtn: (active) => ({
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '8px 0',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "'Exo 2', sans-serif",
    background: active ? '#fff' : 'transparent',
    color: active ? '#4B3ADB' : '#9ca3af',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
    transition: 'all 0.2s',
  }),
  tabRow: {
    display: 'flex',
    gap: 0,
    marginBottom: 24,
    borderBottom: '2px solid #e5e7eb',
  },
  tab: (active) => ({
    padding: '10px 0',
    marginRight: 28,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: active ? 700 : 500,
    color: active ? '#4B3ADB' : '#9ca3af',
    fontFamily: "'Exo 2', sans-serif",
    borderBottom: active ? '2px solid #4B3ADB' : '2px solid transparent',
    marginBottom: -2,
    transition: 'all 0.2s',
  }),
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 6,
    fontFamily: "'Exo 2', sans-serif",
  },
  inputWrap: {
    position: 'relative',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    fontSize: 14,
    color: '#111827',
    background: '#f9fafb',
    outline: 'none',
    fontFamily: "'Exo 2', sans-serif",
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  },
  eyeBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9ca3af',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    fontSize: 12,
  },
  link: {
    color: '#4B3ADB',
    cursor: 'pointer',
    textDecoration: 'none',
    fontWeight: 500,
    fontFamily: "'Exo 2', sans-serif",
  },
  btn: (loading) => ({
    width: '100%',
    padding: '12px 0',
    background: '#4B3ADB',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1,
    fontFamily: "'Exo 2', sans-serif",
    transition: 'opacity 0.2s',
  }),
  switchLink: {
    textAlign: 'center',
    marginTop: 16,
    fontSize: 13,
    color: '#6b7280',
    fontFamily: "'Exo 2', sans-serif",
  },
  errorMsg: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 6,
    padding: '8px 12px',
    color: '#dc2626',
    fontSize: 12,
    marginBottom: 16,
    fontFamily: "'Exo 2', sans-serif",
  },
  successMsg: {
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: 6,
    padding: '8px 12px',
    color: '#16a34a',
    fontSize: 12,
    marginBottom: 16,
    fontFamily: "'Exo 2', sans-serif",
  },
  rightTitle: {
    fontSize: 24,
    fontWeight: 700,
    marginBottom: 10,
    fontFamily: "'Rajdhani', sans-serif",
    letterSpacing: 1,
    textAlign: 'center',
  },
  rightDesc: {
    fontSize: 13,
    lineHeight: 1.5,
    textAlign: 'center',
    opacity: 0.85,
    fontFamily: "'Exo 2', sans-serif",
    maxWidth: 260,
  },
  pendingNotice: {
    background: 'rgba(217, 119, 6, 0.15)',
    border: '1px solid rgba(217, 119, 6, 0.4)',
    borderRadius: 8,
    padding: '16px',
    color: '#f59e0b',
    fontSize: 13,
    lineHeight: 1.5,
    fontFamily: "'Exo 2', sans-serif",
    textAlign: 'center',
    marginBottom: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  deniedNotice: {
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    borderRadius: 8,
    padding: '16px',
    color: '#f87171',
    fontSize: 13,
    lineHeight: 1.5,
    fontFamily: "'Exo 2', sans-serif",
    textAlign: 'center',
    marginBottom: 16,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
};

function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // If session check is done and user is already logged in, send to dashboard
  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const [role, setRole] = useState('user');
  const [tab, setTab] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState(null);

  const isAdmin = role === 'admin';

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setApprovalStatus(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid credentials');
      if (err.status) {
        setApprovalStatus(err.status);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setApprovalStatus(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_BASE || '';
      await apiClient(`${apiBase}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      setSuccess('Your account is awaiting admin approval.');
      toast.success('Registration submitted for approval.');
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setTab('login');
        setSuccess('');
        setApprovalStatus('pending');
      }, 2000);
    } catch (err) {
      logger.error('Registration failed:', err);
      setError(err.message || 'Registration failed');
      toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = (newTab) => {
    setTab(newTab);
    setError('');
    setSuccess('');
    setApprovalStatus(null);
    setPassword('');
    setConfirmPassword('');
  };

  const rightContent = isAdmin
    ? {
        icon: 'shield-check',
        title: 'Admin Portal',
        desc: 'Full access — upload, sync, reset and manage users',
      }
    : { icon: 'view', title: 'User Portal', desc: 'View-only access to all production modules' };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.left}>
          <div style={s.logo}>
            <div style={s.logoMark}>VM</div>
            <div>
              <div style={s.logoText}>VELAN METROLOGY</div>
              <div style={s.logoSub}>COMMAND CENTER</div>
            </div>
          </div>

          <div style={s.roleToggle}>
            <button
              style={s.roleBtn(isAdmin)}
              onClick={() => {
                setRole('admin');
                resetForm('login');
              }}
            >
              <IconShield size={16} />
              Admin
            </button>
            <button
              style={s.roleBtn(!isAdmin)}
              onClick={() => {
                setRole('user');
                resetForm('login');
              }}
            >
              <IconUser size={16} />
              User
            </button>
          </div>

          {!isAdmin && (
            <div style={s.tabRow}>
              <button style={s.tab(tab === 'login')} onClick={() => resetForm('login')}>
                Log in
              </button>
              <button style={s.tab(tab === 'register')} onClick={() => resetForm('register')}>
                Register
              </button>
            </div>
          )}

          {error && <div style={s.errorMsg}>{error}</div>}
          {success && <div style={s.successMsg}>{success}</div>}

          {tab === 'login' ? (
            <form
              onSubmit={handleLogin}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              <div style={s.fieldGroup}>
                <label style={s.label}>Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  style={s.input}
                  onFocus={(e) => (e.target.style.borderColor = '#4B3ADB')}
                  onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
                />
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>Password</label>
                <div style={s.inputWrap}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    style={s.input}
                    onFocus={(e) => (e.target.style.borderColor = '#4B3ADB')}
                    onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
                  />
                  <button
                    type="button"
                    style={s.eyeBtn}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </div>
              {approvalStatus ? (
                <div style={{ marginTop: 20 }}>
                  {approvalStatus === 'pending' ? (
                    <div style={s.pendingNotice}>
                      <span style={{ fontSize: 24 }}>🕐</span>
                      <strong>Waiting for admin approval.</strong>
                      <span>Please check back later.</span>
                    </div>
                  ) : (
                    <div style={s.deniedNotice}>
                      <span style={{ fontSize: 24 }}>❌</span>
                      <strong>Your registration was denied.</strong>
                      <span>Contact admin.</span>
                    </div>
                  )}
                  <div style={{ textAlign: 'center', marginTop: 12 }}>
                    <span
                      style={{ ...s.link, fontSize: 13, cursor: 'pointer' }}
                      onClick={() => setApprovalStatus(null)}
                    >
                      Back to Log In
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <div style={s.linkRow}>
                    <span style={{ ...s.link, fontSize: 12 }}>Terms &amp; Conditions</span>
                    <span style={{ ...s.link, fontSize: 12 }}>Forgot Password?</span>
                  </div>
                  <button type="submit" disabled={loading} style={s.btn(loading)}>
                    {loading ? 'Signing in\u2026' : 'Log In'}
                  </button>
                  {!isAdmin && (
                    <div style={s.switchLink}>
                      Don&apos;t have an account?{' '}
                      <span
                        style={{ ...s.link, cursor: 'pointer' }}
                        onClick={() => resetForm('register')}
                      >
                        Register
                      </span>
                    </div>
                  )}
                </>
              )}
            </form>
          ) : (
            <form
              onSubmit={handleRegister}
              style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
            >
              <div style={s.fieldGroup}>
                <label style={s.label}>Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  style={s.input}
                  onFocus={(e) => (e.target.style.borderColor = '#4B3ADB')}
                  onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
                />
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>Password</label>
                <div style={s.inputWrap}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    style={s.input}
                    onFocus={(e) => (e.target.style.borderColor = '#4B3ADB')}
                    onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
                  />
                  <button
                    type="button"
                    style={s.eyeBtn}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </div>
              <div style={s.fieldGroup}>
                <label style={s.label}>Confirm Password</label>
                <div style={s.inputWrap}>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    style={s.input}
                    onFocus={(e) => (e.target.style.borderColor = '#4B3ADB')}
                    onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
                  />
                  <button
                    type="button"
                    style={s.eyeBtn}
                    onClick={() => setShowConfirm(!showConfirm)}
                  >
                    {showConfirm ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                style={{ ...s.btn(loading), marginTop: 'auto' }}
              >
                {loading ? 'Creating account\u2026' : 'Create Account'}
              </button>
              <div style={s.switchLink}>
                Already have an account?{' '}
                <span style={{ ...s.link, cursor: 'pointer' }} onClick={() => resetForm('login')}>
                  Log in
                </span>
              </div>
            </form>
          )}
        </div>

        <div style={s.right}>
          <div style={{ marginBottom: 20 }}>
            {isAdmin ? <IconShieldCheck size={64} /> : <IconView size={64} />}
          </div>
          <div style={s.rightTitle}>{rightContent.title}</div>
          <div style={s.rightDesc}>{rightContent.desc}</div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
