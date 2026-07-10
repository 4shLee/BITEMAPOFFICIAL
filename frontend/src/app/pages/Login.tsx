import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Eye, EyeOff, Globe2, Lock, Mail, ShieldAlert, ShieldCheck, Zap, UserPlus } from "lucide-react";
import { authAPI } from "../../lib/services/api";
import { ASSIGNABLE_ROLES, getDefaultPathForRole, getStoredUser, hasAuthSession } from "../../lib/auth/roleAccess";
import { toast } from "sonner";

const DEMO_MODE = false;
const REQUESTABLE_ROLES = ASSIGNABLE_ROLES.filter((role) => role.value !== 'system_admin');

const initialRequestForm = {
  fullName: "",
  email: "",
  phone: "",
  role: "",
  password: "",
  confirmPassword: "",
};

function RequestedRoleDropdown({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedRole = REQUESTABLE_ROLES.find((role) => role.value === value);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={'flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-sm shadow-sm shadow-slate-900/5 transition-colors focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 ' + (open ? 'border-teal-600 bg-white ring-2 ring-teal-500/20' : 'border-slate-200 bg-slate-50/70')}
      >
        <span className={selectedRole ? 'font-medium text-slate-900' : 'text-slate-400'}>
          {selectedRole?.label || 'Select requested role'}
        </span>
        <ChevronDown className={'h-4 w-4 text-slate-400 transition-transform ' + (open ? 'rotate-180 text-teal-700' : '')} />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-teal-950/12"
        >
          {REQUESTABLE_ROLES.map((role) => {
            const selected = role.value === value;

            return (
              <button
                key={role.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(role.value);
                  setOpen(false);
                }}
                className={'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ' + (selected ? 'bg-teal-50 text-teal-800' : 'text-slate-700 hover:bg-emerald-50 hover:text-teal-800')}
              >
                {role.label}
                {selected && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

    if (!requestForm.role) {
      toast.error("Please select a requested role.");
      return;
    }

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
    setRequestForm(initialRequestForm);
  };

  const handleDemoAccess = () => {
    toast.success("Demo access granted - welcome!");
    navigate("/dashboard");
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-slate-50 bg-cover bg-center bg-no-repeat"
      style={{
        fontFamily: "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        backgroundImage: "url('/images/login-bg.png')",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

        @keyframes loginGlowShift {
          0%, 100% { transform: translate3d(-3%, -2%, 0) scale(1); opacity: 0.42; }
          50% { transform: translate3d(4%, 3%, 0) scale(1.06); opacity: 0.62; }
        }

        @keyframes loginWaveDrift {
          0% { transform: translate3d(-4%, 0, 0); }
          100% { transform: translate3d(4%, -1%, 0); }
        }

        @keyframes loginDotFloat {
          0%, 100% { transform: translate3d(0, 0, 0); opacity: 0.18; }
          50% { transform: translate3d(18px, -14px, 0); opacity: 0.28; }
        }

        .login-animated-glow {
          background:
            radial-gradient(circle at 35% 35%, rgba(255,255,255,0.34), transparent 30%),
            radial-gradient(circle at 72% 60%, rgba(20,184,166,0.24), transparent 34%);
          animation: loginGlowShift 18s ease-in-out infinite;
        }

        .login-animated-wave {
          background:
            linear-gradient(112deg, transparent 0%, rgba(255,255,255,0.22) 45%, transparent 72%),
            repeating-linear-gradient(100deg, rgba(255,255,255,0.13) 0 1px, transparent 1px 14px);
          clip-path: ellipse(78% 34% at 50% 100%);
          animation: loginWaveDrift 22s ease-in-out infinite alternate;
        }

        .login-animated-dots {
          background-image: radial-gradient(circle, rgba(255,255,255,0.58) 1px, transparent 1.5px);
          background-size: 28px 28px;
          mask-image: linear-gradient(115deg, transparent 0%, black 38%, black 72%, transparent 100%);
          animation: loginDotFloat 16s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .login-animated-glow,
          .login-animated-wave,
          .login-animated-dots {
            animation: none;
          }
        }
      `}</style>
      <header className="relative z-10 border-b border-slate-200/70 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-2 sm:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/images/bitemap-logo.png" alt="BITEMAP logo" className="h-10 w-10 object-contain sm:h-12 sm:w-12" />
              <div>
                <h1 className="text-[21px] font-extrabold leading-tight text-teal-800 sm:text-[23px]">BITEMAP</h1>
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
        className="relative flex min-h-[calc(100vh-108px)] flex-1 items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat px-4 py-3 sm:py-4"
        style={{ backgroundImage: "url('/images/login-bg.png')" }}
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/8 via-teal-50/4 to-teal-950/12" />
        <div className="login-animated-glow pointer-events-none absolute inset-0" />
        <div className="login-animated-dots pointer-events-none absolute left-0 top-[18%] h-[44%] w-[58%] opacity-60" />
        <div className="login-animated-wave pointer-events-none absolute inset-x-[-8%] bottom-[-10%] h-[34%] opacity-45" />

        <section className="relative w-full max-w-[480px] rounded-[28px] border border-white/85 bg-white/95 px-6 py-5 shadow-[0_22px_70px_rgba(15,118,110,0.24)] backdrop-blur-md sm:px-8 sm:py-6">
          <div className="mb-4 text-center">
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 shadow-inner shadow-teal-900/5">
              <img src="/images/bitemap-logo.png" alt="BITEMAP logo" className="h-12 w-12 object-contain" />
            </div>
            <p className="text-[30px] font-extrabold leading-tight text-teal-800 sm:text-[34px]">BITEMAP</p>
            <p className="mx-auto mt-1.5 max-w-[390px] text-[13px] font-medium leading-relaxed text-slate-600">
              GIS-Based Animal Bite Incident Tracking and Anti-Rabies Vaccination Monitoring System
            </p>
          </div>

          {requestSubmitted ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h2 className="text-[23px] font-extrabold leading-tight text-slate-900 sm:text-[25px]">Request Submitted</h2>
              <p className="mx-auto mt-2 max-w-[360px] text-sm leading-relaxed text-slate-500">
                Your account request is now pending administrator approval. You can sign in after the administrator approves it.
              </p>
              <button
                type="button"
                onClick={closeRequestModal}
                className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-teal-700 px-4 text-sm font-bold text-white transition-colors hover:bg-teal-800"
              >
                Back to Sign In
              </button>
            </div>
          ) : showRequestModal ? (
            <>
              <div className="mb-4 text-center">
                <div className="mx-auto mb-2 h-1 w-11 rounded-full bg-teal-200" />
                <h2 className="text-[23px] font-extrabold leading-tight text-slate-900 sm:text-[25px]">Request Account Approval</h2>
                <p className="mt-1 text-[13px] font-semibold text-slate-500">For authorized clinic personnel</p>
              </div>

              <form onSubmit={handleRequestSubmit} className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-800">Full Name</label>
                  <input
                    type="text"
                    value={requestForm.fullName}
                    onChange={(e) => setRequestForm({ ...requestForm, fullName: e.target.value })}
                    required
                    placeholder="Enter your full name"
                    className="w-full rounded-xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-900/5 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-800">Email</label>
                    <input
                      type="email"
                      value={requestForm.email}
                      onChange={(e) => setRequestForm({ ...requestForm, email: e.target.value })}
                      required
                      placeholder="Enter email address"
                      className="w-full rounded-xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-900/5 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-800">Phone</label>
                    <input
                      type="tel"
                      value={requestForm.phone}
                      onChange={(e) => setRequestForm({ ...requestForm, phone: e.target.value })}
                      placeholder="09XXXXXXXXX"
                      className="w-full rounded-xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-900/5 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-800">Requested Role</label>
                  <RequestedRoleDropdown
                    value={requestForm.role}
                    onChange={(role) => setRequestForm({ ...requestForm, role })}
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-800">Password</label>
                    <div className="relative">
                      <input
                        type={showRequestPassword ? "text" : "password"}
                        value={requestForm.password}
                        onChange={(e) => setRequestForm({ ...requestForm, password: e.target.value })}
                        required
                        minLength={8}
                        placeholder="At least 8 characters"
                        className="w-full rounded-xl border border-slate-200 bg-white/90 px-3.5 py-2.5 pr-10 text-sm text-slate-900 shadow-sm shadow-slate-900/5 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRequestPassword((value) => !value)}
                        className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition-colors hover:text-teal-800"
                        aria-label={showRequestPassword ? "Hide password" : "Show password"}
                      >
                        {showRequestPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-800">Confirm Password</label>
                    <input
                      type={showRequestPassword ? "text" : "password"}
                      value={requestForm.confirmPassword}
                      onChange={(e) => setRequestForm({ ...requestForm, confirmPassword: e.target.value })}
                      required
                      minLength={8}
                      placeholder="Repeat password"
                      className="w-full rounded-xl border border-slate-200 bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm shadow-slate-900/5 placeholder:text-slate-400 focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-2.5">
                  <p className="text-xs leading-relaxed text-amber-700">
                    Account access remains blocked until an administrator approves this request.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={closeRequestModal}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-teal-700/35 bg-white px-4 text-sm font-bold text-teal-800 transition-colors hover:bg-teal-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Sign In
                  </button>
                  <button
                    type="submit"
                    disabled={isRequestSubmitting}
                    className="inline-flex h-11 items-center justify-center rounded-full bg-teal-700 px-4 text-sm font-bold text-white transition-colors hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRequestSubmitting ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="mb-4 text-center">
                <div className="mx-auto mb-2 h-1 w-11 rounded-full bg-teal-200" />
                <h2 className="text-[23px] font-extrabold leading-tight text-slate-900 sm:text-[25px]">Sign In</h2>
                <p className="mt-1 text-[13px] font-semibold text-slate-500">Authorized Staff Login</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label htmlFor="username" className="sr-only">
                    Email
                  </label>
                  <div className="relative">
                    <div className="absolute left-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-teal-50 text-teal-700">
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
                      className="h-11 w-full rounded-full border border-slate-200 bg-white/90 pl-14 pr-5 text-[14px] font-medium text-slate-900 shadow-sm shadow-slate-900/5 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="sr-only">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute left-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-teal-50 text-teal-700">
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
                      className="h-11 w-full rounded-full border border-slate-200 bg-white/90 pl-14 pr-12 text-[14px] font-medium text-slate-900 shadow-sm shadow-slate-900/5 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
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
                  className="relative h-12 w-full rounded-full border border-transparent bg-gradient-to-r from-teal-800 to-teal-600 text-[15px] font-extrabold text-white shadow-lg shadow-teal-900/20 transition-colors hover:from-teal-900 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/35 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
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
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-teal-700/55 bg-white px-4 text-[14px] font-extrabold text-teal-800 transition-colors hover:border-teal-700 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:ring-offset-2"
                >
                  <UserPlus className="h-5 w-5" />
                  Request Account Approval
                </button>
              </form>

              <div className="mt-4 flex items-center justify-center gap-2.5 rounded-2xl border border-rose-200/80 bg-rose-50/80 px-4 py-2.5">
                <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
                <p className="text-center text-[13px] font-semibold leading-snug text-rose-700">
                  Access is restricted to authorized clinic personnel only.
                </p>
              </div>

              <p className="mx-auto mt-2 text-center text-[13px] font-medium leading-snug text-slate-500">
                Access depends on your assigned role.
              </p>
            </>
          )}
        </section>
      </main>

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
