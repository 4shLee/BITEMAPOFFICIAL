import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Eye, EyeOff, Globe2, Lock, Mail, ShieldAlert, ShieldCheck, Zap, UserPlus } from "lucide-react";
import { authAPI, getErrorMessage } from "../../lib/services/api";
import { ASSIGNABLE_ROLES, getDefaultPathForRole, getStoredUser, hasAuthSession } from "../../lib/auth/roleAccess";
import { toast } from "sonner";
import { AnimatedGISBackground } from "../components/Brand/AnimatedGISBackground";
import { BITEMAP_FONT_FAMILY, BITEMAP_LOGO_SRC } from "../components/Brand/brand";

const DEMO_MODE = false;


export function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "An error occurred during login."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoAccess = () => {
    toast.success("Demo access granted - welcome!");
    navigate("/dashboard");
  };

  return (
    <div
      className="relative isolate flex min-h-screen flex-col bg-slate-50 overflow-hidden"
      style={{
        fontFamily: BITEMAP_FONT_FAMILY,
      }}
    >
      <AnimatedGISBackground />

      <header className="relative z-10 border-b border-slate-200/70 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-2 sm:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={BITEMAP_LOGO_SRC} alt="BITEMAP logo" className="h-10 w-10 object-contain sm:h-12 sm:w-12" />
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
        className="relative z-10 flex min-h-[calc(100vh-108px)] flex-1 items-center justify-center px-4 py-6 sm:py-8"
      >
        <section className="relative w-full max-w-[440px] rounded-[28px] border border-white/85 bg-white/95 px-6 py-8 shadow-[0_22px_70px_rgba(15,118,110,0.24)] backdrop-blur-md sm:px-10 sm:py-10">
          <div className="mb-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 shadow-inner shadow-teal-900/5">
              <img src={BITEMAP_LOGO_SRC} alt="BITEMAP logo" className="h-12 w-12 object-contain" />
            </div>
          </div>

          <div className="mb-6 text-center">
            <h2 className="text-[24px] font-extrabold leading-tight text-slate-900 sm:text-[26px]">Staff Sign In</h2>
            <p className="mt-1.5 text-[14px] font-medium text-slate-500">Access your BITEMAP workspace</p>
          </div>

              <form onSubmit={handleSubmit} className="space-y-4">
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

                <div className="mt-4 text-center">
                  <Link
                    to="/request-account-approval"
                    className="text-[14px] font-medium text-teal-700 transition-colors hover:text-teal-900 hover:underline focus:outline-none"
                  >
                    Need an account? Request access
                  </Link>
                </div>
              </form>

              <p className="mt-6 text-center text-[13px] font-medium text-slate-400">
                Authorized clinic staff only
              </p>
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
