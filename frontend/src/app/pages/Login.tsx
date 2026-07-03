import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { AlertCircle, Eye, EyeOff, Lock, ArrowLeft, ShieldAlert, Zap, UserPlus, X, ShieldCheck } from "lucide-react";
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
                <p className="text-xs text-muted-foreground leading-tight">Animal Bite Incident Tracking and Vaccination Monitoring</p>
              </div>
            </div>
            <Link
              to="/public"
              className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary-bg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Public Portal
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-xl shadow-md overflow-hidden">
            <div className="bg-primary px-8 pt-8 pb-7 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-white/10 ring-2 ring-white/20 mb-5">
                <Lock className="w-8 h-8 text-white" strokeWidth={1.5} />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-wide mb-2">BITEMAP</h2>
              <p className="text-sm text-white/85 leading-relaxed max-w-xs mx-auto mb-2">
                GIS-Based Animal Bite Incident Tracking and Anti-Rabies Vaccination Monitoring System
              </p>
            </div>

            <div className="px-8 pt-7 pb-10">
              <div className="flex items-center gap-2 mb-6">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-2">
                  Authorized User Sign In
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1.5">
                    Email
                  </label>
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    placeholder="Enter your email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-input-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 pr-11 text-sm bg-input-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute inset-y-0 right-3.5 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                  className="w-full py-2.5 bg-card text-foreground text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-2"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
                      Signing in...
                    </span>
                  ) : (
                    "Sign In with Credentials"
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowRequestModal(true)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  Request Account Approval
                </button>

                <Link
                  to="/public"
                  className="flex items-center justify-center gap-1.5 w-full py-2.5 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:text-foreground hover:border-primary/40 hover:bg-primary-bg transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Public Portal
                </Link>
              </form>

              <div className="mt-5 flex items-start gap-2.5 bg-destructive-bg border border-destructive/15 rounded-lg px-4 py-3">
                <ShieldAlert className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive leading-relaxed">
                  Access is restricted to authorized personnel only.
                </p>
              </div>

              <p className="mt-3 text-[11px] text-center text-muted-foreground leading-relaxed">
                User permissions are automatically determined based on account credentials.
              </p>
            </div>
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

      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-2">(c) 2026 Digos City Health Office - Cor Jesu College</p>
            <p>Department of Health - Philippines - Republic Act 9482: Anti-Rabies Act of 2007</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
