import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { Eye, EyeOff, Globe2, Lock, ArrowRight, Mail, ShieldAlert, Zap, UserPlus, X, ShieldCheck } from "lucide-react";
import { authAPI } from "../../lib/services/api";
import { ASSIGNABLE_ROLES, getDefaultPathForRole, getStoredUser, hasAuthSession } from "../../lib/auth/roleAccess";
import { toast } from "sonner";

const DEMO_MODE = false;
const REQUESTABLE_ROLES = ASSIGNABLE_ROLES;

const initialRequestForm = {
  fullName: "",
  email: "",
  phone: "",
  role: "nurse_vaccinator",
  password: "",
  confirmPassword: "",
};

export function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState(initialRequestForm);
  const [showRequestPassword, setShowRequestPassword] = useState(false);
  const [isRequestSubmitting, setIsRequestSubmitting] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (hasAuthSession() && user) {
      navigate(getDefaultPathForRole(user.role), { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = await authAPI.signIn(username.trim(), password);
      if (result.success) {
        toast.success("Login successful!");
        navigate(getDefaultPathForRole(result.user?.role));
      } else {
        toast.error(result.error || "Login failed. Please check your credentials.");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred during login.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (requestForm.password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    if (requestForm.password !== requestForm.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsRequestSubmitting(true);
    try {
      const result = await authAPI.signUp(
        requestForm.email.trim(),
        requestForm.password,
        requestForm.fullName.trim(),
        requestForm.role,
        requestForm.phone.trim() || undefined
      );

      if (result.success) {
        setRequestSubmitted(true);
        setRequestForm(initialRequestForm);
        toast.success(result.message || "Account request submitted for System Administrator approval.");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to submit account request.");
    } finally {
      setIsRequestSubmitting(false);
    }
  };

  const closeRequestModal = () => {
    setShowRequestModal(false);
    setRequestSubmitted(false);
    setShowRequestPassword(false);
  };

  const handleDemoAccess = () => {
    toast.success("Demo access granted - welcome!");
    navigate("/dashboard");
  };

  return (
    <div
      className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-slate-50 bg-cover bg-center bg-no-repeat"
      style={{
        fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        backgroundImage: "url('/images/login-bg.png')",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');`}</style>
      <header className="relative z-10 border-b border-slate-200/70 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-3 sm:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/images/bitemap-logo.png" alt="BITEMAP logo" className="h-12 w-12 object-contain sm:h-14 sm:w-14" />
              <div>
                <h1 className="text-[22px] font-extrabold leading-tight text-teal-800 sm:text-[24px]">BITEMAP</h1>
                <p className="hidden text-[13px] font-medium leading-tight text-slate-500 sm:block">Animal Bite Incident Tracking and Vaccination Monitoring</p>
              </div>
            </div>
            <Link
              to="/public"
              className="inline-flex items-center gap-2 rounded-full border border-teal-700/35 bg-white px-4 py-2 text-[13px] font-extrabold text-teal-800 shadow-sm transition-colors hover:border-teal-700 hover:bg-teal-50 sm:px-5 sm:py-2.5 sm:text-[14px]"
            >
              <Globe2 className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Public Portal</span>
              <span className="sm:hidden">Portal</span>
            </Link>
          </div>
        </div>
      </header>

      <main
        className="relative flex flex-1 items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat px-4 py-6"
        style={{ backgroundImage: "url('/images/login-bg.png')" }}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/8 via-teal-50/4 to-teal-950/12" />

        <section className="relative w-full max-w-[500px] rounded-[30px] border border-white/85 bg-white/95 px-7 py-7 shadow-[0_24px_80px_rgba(15,118,110,0.24)] backdrop-blur-md sm:px-9 sm:py-8">
          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-teal-50 shadow-inner shadow-teal-900/5">
              <img src="/images/bitemap-logo.png" alt="BITEMAP logo" className="h-16 w-16 object-contain" />
            </div>
            <p className="text-[34px] font-extrabold leading-tight text-teal-800 sm:text-[38px]">BITEMAP</p>
            <p className="mx-auto mt-2 max-w-[390px] text-[14px] font-medium leading-relaxed text-slate-600">
              GIS-Based Animal Bite Incident Tracking and Anti-Rabies Vaccination Monitoring System
            </p>
          </div>

          <div className="mb-5 text-center">
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-teal-200" />
            <h2 className="text-[24px] font-extrabold leading-tight text-slate-900 sm:text-[26px]">Sign In</h2>
            <p className="mt-1.5 text-[14px] font-semibold text-slate-500">Authorized Staff Login</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="sr-only">
                Email
              </label>
              <div className="relative">
                <div className="absolute left-0 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Email address"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="h-12 w-full rounded-full border border-slate-200 bg-white/90 pl-16 pr-5 text-[15px] font-medium text-slate-900 shadow-sm shadow-slate-900/5 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-0 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-teal-50 text-teal-700">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 w-full rounded-full border border-slate-200 bg-white/90 pl-16 pr-12 text-[15px] font-medium text-slate-900 shadow-sm shadow-slate-900/5 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-5 flex items-center text-slate-500 transition-colors hover:text-slate-800"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {DEMO_MODE && (
              <div className="mt-1 rounded-xl border border-primary/25 bg-primary-bg px-4 py-3">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                  <Zap className="w-3 h-3" /> Demo Mode - No credentials required
                </p>
                <button
                  type="button"
                  onClick={handleDemoAccess}
                  className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-1"
                >
                  Enter Demo Dashboard
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="relative h-[52px] w-full rounded-full border border-transparent bg-gradient-to-r from-teal-800 to-teal-600 text-[15px] font-extrabold text-white shadow-lg shadow-teal-900/20 transition-colors hover:from-teal-900 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/35 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/35 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowRequestModal(true)}
              className="inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-full border border-teal-700/55 bg-white px-4 text-[15px] font-extrabold text-teal-800 transition-colors hover:border-teal-700 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:ring-offset-2"
            >
              <UserPlus className="h-5 w-5" />
              Request Account Approval
            </button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-2.5 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-3">
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
            <p className="text-center text-[13px] font-semibold leading-snug text-rose-700">
              Access is restricted to authorized clinic personnel only.
            </p>
          </div>

          <p className="mx-auto mt-3 text-center text-[13px] font-medium leading-snug text-slate-500">
            Access depends on your assigned role.
          </p>
        </section>
      </main>

      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-bg text-primary">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">Request Account Approval</h2>
                  <p className="text-xs text-muted-foreground">For ABC staff account registration</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeRequestModal}
                className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Close account request form"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {requestSubmitted ? (
              <div className="px-8 py-10 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-success-bg text-success">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">Request Submitted</h3>
                <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                  Your account request is now pending System Administrator approval. You can sign in after the administrator approves it.
                </p>
                <button
                  type="button"
                  onClick={closeRequestModal}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-dark transition-colors"
                >
                  Return to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleRequestSubmit} className="space-y-4 px-6 py-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={requestForm.fullName}
                    onChange={(e) => setRequestForm({ ...requestForm, fullName: e.target.value })}
                    required
                    placeholder="Enter your full name"
                    className="w-full rounded-lg border border-input bg-input-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                    <input
                      type="email"
                      value={requestForm.email}
                      onChange={(e) => setRequestForm({ ...requestForm, email: e.target.value })}
                      required
                      placeholder="you@bitemap.local"
                      className="w-full rounded-lg border border-input bg-input-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Phone</label>
                    <input
                      type="tel"
                      value={requestForm.phone}
                      onChange={(e) => setRequestForm({ ...requestForm, phone: e.target.value })}
                      placeholder="09xx xxx xxxx"
                      className="w-full rounded-lg border border-input bg-input-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Requested Role</label>
                  <select
                    value={requestForm.role}
                    onChange={(e) => setRequestForm({ ...requestForm, role: e.target.value })}
                    className="w-full rounded-lg border border-input bg-input-background px-3.5 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {REQUESTABLE_ROLES.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        type={showRequestPassword ? "text" : "password"}
                        value={requestForm.password}
                        onChange={(e) => setRequestForm({ ...requestForm, password: e.target.value })}
                        required
                        minLength={8}
                        placeholder="At least 8 characters"
                        className="w-full rounded-lg border border-input bg-input-background px-3.5 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRequestPassword((value) => !value)}
                        className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showRequestPassword ? "Hide password" : "Show password"}
                      >
                        {showRequestPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">Confirm Password</label>
                    <input
                      type={showRequestPassword ? "text" : "password"}
                      value={requestForm.confirmPassword}
                      onChange={(e) => setRequestForm({ ...requestForm, confirmPassword: e.target.value })}
                      required
                      minLength={8}
                      placeholder="Repeat password"
                      className="w-full rounded-lg border border-input bg-input-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-warning/25 bg-warning-bg px-4 py-3">
                  <p className="text-xs leading-relaxed text-warning">
                    Account access remains blocked until a System Administrator approves this request.
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeRequestModal}
                    className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isRequestSubmitting}
                    className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
                  >
                    {isRequestSubmitting ? "Submitting..." : "Submit Account Request"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <footer className="relative z-10 border-t border-transparent bg-transparent">
        <div className="max-w-7xl mx-auto px-6 py-2.5">
          <div className="text-center text-[13px] font-semibold text-white drop-shadow">
            <p>© 2026 BITEMAP Capstone Project - Cor Jesu College</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
