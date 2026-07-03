import { useState } from 'react';
import { Link } from 'react-router';
import { AlertCircle, ArrowLeft, Eye, EyeOff, Lock, ShieldCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { authAPI } from '../../lib/services/api';
import { ASSIGNABLE_ROLES } from '../../lib/auth/roleAccess';

const REQUESTABLE_ROLES = ASSIGNABLE_ROLES;

export function Signup() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'nurse_vaccinator',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await authAPI.signUp(
        form.email.trim(),
        form.password,
        form.fullName.trim(),
        form.role,
        form.phone.trim() || undefined
      );

      if (result.success) {
        setSubmitted(true);
        toast.success(result.message || 'Account request submitted for System Administrator approval.');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit account request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">BITEMAP</h1>
                <p className="text-xs text-muted-foreground leading-tight">Account Request for Authorized Personnel</p>
              </div>
            </div>
            <Link
              to="/login"
              className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary-bg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Login
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="bg-card border border-border rounded-xl shadow-md overflow-hidden">
            <div className="bg-primary px-8 pt-8 pb-7 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-white/10 ring-2 ring-white/20 mb-5">
                <UserPlus className="w-8 h-8 text-white" strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-wide mb-2">Request Account</h2>
              <p className="text-sm text-white/85 leading-relaxed max-w-sm mx-auto mb-2">
                Submit your ABC staff account request. A System Administrator must approve it before login is allowed.
              </p>
            </div>

            <div className="px-8 pt-7 pb-10">
              {submitted ? (
                <div className="text-center space-y-5">
                  <div className="mx-auto w-14 h-14 rounded-xl bg-success-bg flex items-center justify-center">
                    <ShieldCheck className="w-7 h-7 text-success" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">Request Submitted</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Your account is now pending System Administrator approval. You can sign in after a System Administrator approves your request.
                    </p>
                  </div>
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center w-full py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary-dark transition-colors"
                  >
                    Return to Login
                  </Link>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-6">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-2">
                      Authorized Account Request
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                      <input
                        type="text"
                        value={form.fullName}
                        onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                        required
                        placeholder="Enter your full name"
                        className="w-full px-3.5 py-2.5 text-sm bg-input-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          required
                          placeholder="you@bitemap.local"
                          className="w-full px-3.5 py-2.5 text-sm bg-input-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Phone</label>
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          placeholder="09xx xxx xxxx"
                          className="w-full px-3.5 py-2.5 text-sm bg-input-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">Requested Role</label>
                      <select
                        value={form.role}
                        onChange={(e) => setForm({ ...form, role: e.target.value })}
                        className="w-full px-3.5 py-2.5 text-sm bg-input-background border border-input rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                      >
                        {REQUESTABLE_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            required
                            minLength={8}
                            placeholder="At least 8 characters"
                            className="w-full px-3.5 py-2.5 pr-10 text-sm bg-input-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((value) => !value)}
                            className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={form.confirmPassword}
                          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                          required
                          minLength={8}
                          placeholder="Repeat password"
                          className="w-full px-3.5 py-2.5 text-sm bg-input-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2"
                    >
                      {isSubmitting ? 'Submitting Request...' : 'Submit Account Request'}
                    </button>

                    <Link
                      to="/login"
                      className="flex items-center justify-center gap-1.5 w-full py-2.5 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:text-foreground hover:border-primary/40 hover:bg-primary-bg transition-colors"
                    >
                      <Lock className="w-4 h-4" />
                      I already have an approved account
                    </Link>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
