import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { FileText, Eye, EyeOff } from 'lucide-react';

const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await register(email, password, name);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-teal-50 via-white to-emerald-50">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-200/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-teal-200/40 rounded-full blur-3xl" />
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 lg:py-16">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div className="hidden lg:block">
            <div className="relative rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-500 to-sky-500 p-8 text-white shadow-xl overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-12 -left-12 w-56 h-56 bg-white/10 rounded-full blur-2xl" />
              <div className="relative">
                <div className="inline-flex items-center justify-center bg-white/20 rounded-2xl p-4 backdrop-blur mb-6 ring-1 ring-white/30">
                  <FileText className="h-10 w-10 text-white" />
                </div>
                <h2 className="text-3xl font-bold leading-tight">Create your account</h2>
                <p className="mt-3 text-white/90">Collaborate in real-time, leave voice notes, and keep your documents in sync with your team.</p>
                <ul className="mt-6 space-y-3 text-sm">
                  <li className="flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-white/80" /> Real-time editing</li>
                  <li className="flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-white/80" /> Voice comments</li>
                  <li className="flex items-center gap-2"><span className="inline-block w-2 h-2 rounded-full bg-white/80" /> Secure access</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="w-full">
            <div className="text-center mb-6 lg:mb-8 lg:hidden">
              <div className="flex items-center justify-center mb-4">
                <div className="bg-teal-600 rounded-xl p-3 shadow-lg">
                  <FileText className="h-8 w-8 text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-gray-900">Join our workspace</h2>
              <p className="text-gray-600 mt-2">Create your account to start collaborating</p>
            </div>

            <div className="bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70 rounded-2xl shadow-xl p-6 sm:p-8 border border-white/60">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Full name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors shadow-sm"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors shadow-sm"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors shadow-sm"
                  placeholder="Create a password (min 6 characters)"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 text-white py-3 px-4 rounded-xl shadow hover:bg-teal-700 active:bg-teal-800 focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating account...
                </div>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-teal-600 hover:text-teal-700 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;