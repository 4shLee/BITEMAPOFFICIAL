import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { AlertCircle, Eye, EyeOff, Lock, ArrowLeft, ArrowRight, Mail, ShieldAlert, Zap, UserPlus, X, ShieldCheck } from "lucide-react";
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
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-[radial-gradient(circle_at_50%_42%,_rgba(45,212,191,0.24),_transparent_28%),radial-gradient(circle_at_24%_35%,_rgba(16,185,129,0.28),_transparent_34%),radial-gradient(circle_at_86%_58%,_rgba(14,116,144,0.34),_transparent_32%),linear-gradient(128deg,_#047647_0%,_#07876f_44%,_#064b6b_100%)]" style={{ fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');`}</style>
      <header className="bg-white border-b border-slate-200/70">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-emerald-700 to-teal-600 rounded-2xl flex items-center justify-center shadow-md shadow-emerald-900/20">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-[22px] font-extrabold text-slate-950 leading-tight">BITEMAP</h1>
                <p className="text-[13px] font-medium text-slate-500 leading-tight">Animal Bite Incident Tracking and Vaccination Monitoring</p>
              </div>
            </div>
            <Link
              to="/public"
              className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 rounded-2xl text-[14px] font-semibold text-slate-600 hover:text-emerald-900 hover:border-emerald-700/35 hover:bg-emerald-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Public Portal
            </Link>
          </div>
        </div>
      </header>

      <main className="relative flex-1 min-h-0 overflow-hidden flex items-center justify-center px-4 py-4 lg:py-3">
        <div className="pointer-events-none absolute inset-0 opacity-35 bg-[radial-gradient(circle_at_50%_44%,_rgba(45,212,191,0.24),_transparent_22%),radial-gradient(circle_at_17%_18%,_rgba(255,255,255,0.16),_transparent_24%),radial-gradient(circle_at_88%_76%,_rgba(20,184,166,0.2),_transparent_28%)]" />
        <div className="pointer-events-none absolute -left-24 top-[-18rem] h-[34rem] w-[34rem] rounded-full bg-emerald-300/[0.09]" />
        <div className="pointer-events-none absolute -right-24 bottom-[-20rem] h-[38rem] w-[38rem] rounded-full bg-teal-300/[0.1]" />
        <div className="pointer-events-none absolute left-16 bottom-[-21rem] h-[40rem] w-[40rem] rounded-full border border-white/[0.07]" />
        <div className="pointer-events-none absolute right-20 top-9 grid grid-cols-6 gap-4 opacity-[0.10]">
          {Array.from({ length: 24 }).map((_, index) => (
            <span key={index} className="h-1.5 w-1.5 rounded-full bg-white" />
          ))}
        </div>
        <div className="pointer-events-none absolute left-20 bottom-24 grid grid-cols-7 gap-4 opacity-[0.10]">
          {Array.from({ length: 28 }).map((_, index) => (
            <span key={index} className="h-1.5 w-1.5 rounded-full bg-white" />
          ))}
        </div>

        <div className="relative w-full max-w-[1120px]">
          <div className="relative flex min-h-[560px] overflow-hidden rounded-[34px] border border-white/75 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.28),0_0_52px_rgba(20,184,166,0.16)] md:h-[600px]">
            <section className="relative hidden w-[45%] overflow-hidden bg-[radial-gradient(circle_at_18%_16%,_rgba(45,212,191,0.34),_transparent_28%),radial-gradient(circle_at_86%_76%,_rgba(16,185,129,0.38),_transparent_28%),linear-gradient(145deg,_#065f46_0%,_#047857_42%,_#155e75_100%)] px-16 py-14 text-white md:flex md:flex-col">
              <div className="pointer-events-none absolute right-[-140px] top-[-92px] h-[790px] w-[270px] rounded-[50%] bg-white" />
              <div className="pointer-events-none absolute -left-24 bottom-[-11rem] h-[26rem] w-[26rem] rounded-full bg-teal-300/18" />
              <div className="pointer-events-none absolute left-[-8rem] bottom-[-14rem] h-[30rem] w-[30rem] rounded-full bg-emerald-200/10" />
              <div className="pointer-events-none absolute bottom-24 right-[-35px] h-56 w-56 rounded-full bg-gradient-to-br from-emerald-300/70 to-teal-800/35 shadow-2xl shadow-emerald-950/30" />
              <div className="pointer-events-none absolute left-10 top-12 grid grid-cols-6 gap-3 opacity-20">
                {Array.from({ length: 36 }).map((_, index) => (
                  <span key={index} className="h-1.5 w-1.5 rounded-full bg-white" />
                ))}
              </div>
              <div className="pointer-events-none absolute bottom-20 left-56 grid grid-cols-5 gap-3 opacity-18">
                {Array.from({ length: 20 }).map((_, index) => (
                  <span key={index} className="h-1.5 w-1.5 rounded-full bg-white" />
                ))}
              </div>

              <div className="relative z-10 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/25 bg-white/12 shadow-lg shadow-emerald-950/20">
                  <AlertCircle className="h-8 w-8 text-white" strokeWidth={1.8} />
                </div>
                <div>
                  <h2 className="text-[28px] font-extrabold leading-none tracking-wide">BITEMAP</h2>
                  <p className="mt-1 max-w-[230px] text-[13.5px] font-semibold leading-snug text-emerald-50/90">
                    Animal Bite Incident Tracking and Vaccination Monitoring
                  </p>
                </div>
              </div>

              <div className="relative z-10 mt-auto max-w-[330px] pb-16">
                <p className="text-[48px] font-extrabold leading-none tracking-[0.08em] text-white">WELCOME</p>
                <p className="mt-6 text-[30px] font-extrabold leading-tight text-emerald-200">BITEMAP</p>
                <div className="mt-5 h-1 w-20 rounded-full bg-emerald-300" />
                <p className="mt-6 text-[17px] font-medium leading-[1.45] text-white/92">
                  GIS-Based Animal Bite Incident Tracking and Anti-Rabies Vaccination Monitoring System
                </p>
              </div>
            </section>

            <section className="relative z-20 flex w-full items-center justify-center bg-white px-7 py-8 md:w-[55%] md:px-12">
              <div className="w-full max-w-[450px]">
                <div className="mb-8 text-center md:text-left">
                  <h2 className="text-[46px] font-extrabold leading-tight text-slate-950 md:text-[52px]">Sign In</h2>
                  <p className="mt-2 text-[18px] font-medium text-slate-500 md:text-[19px]">
                  Authorized Staff Login
                  </p>
                </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="username" className="mb-1.5 block text-[15px] font-bold text-slate-800">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                    <input
                      id="username"
                      type="text"
                      autoComplete="username"
                      placeholder="Enter your email"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="h-[52px] w-full rounded-2xl border border-slate-300 bg-white px-12 text-[15px] font-medium text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/25"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-1.5 block text-[15px] font-bold text-slate-800">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-[52px] w-full rounded-2xl border border-slate-300 bg-white px-12 pr-12 text-[15px] font-medium text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/25"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-4 flex items-center text-slate-500 transition-colors hover:text-slate-800"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                {DEMO_MODE && (
                  <div className="rounded-lg border border-primary/25 bg-primary-bg px-4 py-3 mt-1">
                    <p className="text-[11px] font-semibold text-primary mb-2 flex items-center gap-1.5">
                      <Zap className="w-3 h-3" /> Demo Mode - No credentials required
                    </p>
                    <button
                      type="button"
                      onClick={handleDemoAccess}
                      className="w-full py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-1"
                    >
                      Enter Demo Dashboard
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="relative h-[54px] w-full rounded-2xl border border-transparent bg-gradient-to-r from-emerald-700 to-teal-600 text-[16px] font-extrabold text-white shadow-lg shadow-emerald-900/25 transition-colors hover:from-emerald-800 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/35 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-emerald-700/35 bg-white px-4 text-[16px] font-extrabold text-emerald-800 transition-colors hover:border-emerald-700/55 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:ring-offset-2"
                >
                  <UserPlus className="h-5 w-5" />
                  Request Account Approval
                </button>
              </form>

              <div className="mt-5 flex items-center justify-center gap-2.5 rounded-2xl border border-rose-200/80 bg-rose-50 px-4 py-3">
                <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
                <p className="text-center text-[14px] font-semibold leading-snug text-rose-700">
                  Access is restricted to authorized clinic personnel only.
                </p>
              </div>

              <p className="mx-auto mt-3 text-center text-[14px] font-medium leading-snug text-slate-500">
                Access depends on your assigned role.
              </p>
              </div>
            </section>
          </div>
        </div>
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

      <footer className="border-t border-transparent bg-transparent">
        <div className="max-w-7xl mx-auto px-6 py-2.5">
          <div className="text-center text-[13px] font-medium text-white/90">
            <p>© 2026 BITEMAP Capstone Project - Cor Jesu College</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
