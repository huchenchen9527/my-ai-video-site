import { useState, useCallback, useEffect } from 'react';
import { signUp, signIn, signOut, onAuthChange, isSupabaseConfigured } from './supabase-client';

export function AuthModal({ isOpen, onClose, onLogin, userEmail }) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email.trim() || !password.trim()) {
      setError('请输入邮箱和密码');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('密码至少6个字符');
      setLoading(false);
      return;
    }

    try {
      const result = isLoginMode
        ? await signIn(email, password)
        : await signUp(email, password);

      if (result.error) {
        setError(mapErrorMessage(result.error.message));
      } else {
        setEmail('');
        setPassword('');
        onLogin(result.data?.user?.email || email);
        onClose();
      }
    } catch {
      setError('操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-gray-900/95 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {isLoginMode ? '登录' : '注册'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 transition-colors hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-400">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder-gray-500 outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
              placeholder="your@email.com"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-400">密码</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 pr-10 text-white placeholder-gray-500 outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
                placeholder={isLoginMode ? '输入密码' : '至少6个字符'}
                required
                autoComplete={isLoginMode ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full cursor-pointer rounded-lg bg-white/10 px-4 py-2.5 font-medium text-white transition-all hover:bg-white/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '处理中...' : isLoginMode ? '登录' : '注册'}
          </button>
        </form>

        {/* Toggle mode */}
        <div className="mt-4 text-center text-sm text-gray-400">
          {isLoginMode ? '还没有账号？' : '已有账号？'}
          <button
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setError('');
            }}
            className="ml-1 text-white underline underline-offset-2 hover:text-gray-300"
          >
            {isLoginMode ? '注册' : '登录'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function UserMenu({ userEmail, onLogout, onLogin }) {
  const handleLogout = async () => {
    await signOut();
    onLogout();
  };

  if (!userEmail) {
    return (
      <button
        onClick={onLogin}
        className="flex items-center gap-2 cursor-pointer rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white transition-all hover:bg-white/10"
      >
        <span className="text-base">👤</span>
        登录
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-sm text-gray-400 sm:inline">{userEmail}</span>
      <button
        onClick={handleLogout}
        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white transition-all hover:bg-white/10"
      >
        退出
      </button>
    </div>
  );
}

function AuthStatus({ userEmail, onLogin, onLogout }) {
  if (!isSupabaseConfigured()) return null;
  return <UserMenu userEmail={userEmail} onLogin={onLogin} onLogout={onLogout} />;
}

export function useAuth() {
  const [userEmail, setUserEmail] = useState(() => {
    try {
      return localStorage.getItem('my_ai_user_email') || null;
    } catch {
      return null;
    }
  });

  const handleLogin = useCallback((email) => {
    setUserEmail(email);
    try {
      localStorage.setItem('my_ai_user_email', email);
    } catch {}
  }, []);

  const handleLogout = useCallback(() => {
    setUserEmail(null);
    try {
      localStorage.removeItem('my_ai_user_email');
    } catch {}
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const { data: { subscription } } = onAuthChange((_event, session) => {
      if (session?.user?.email) {
        handleLogin(session.user.email);
      } else {
        handleLogout();
      }
    });
    return () => subscription && subscription.unsubscribe();
  }, []);

  return { userEmail, handleLogin, handleLogout };
}

function mapErrorMessage(message) {
  const map = {
    'Invalid login credentials': '邮箱或密码错误',
    'User already registered': '该邮箱已注册',
    'Email not confirmed': '请先确认邮箱',
    'Weak password': '密码强度不足',
    'Invalid email': '邮箱格式不正确',
    'over_email_send_rate_limit': '发送太频繁，请稍后再试',
  };
  for (const [key, value] of Object.entries(map)) {
    if (message.includes(key)) return value;
  }
  return message;
}
