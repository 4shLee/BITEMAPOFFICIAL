import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router";
import { AlertCircle, ArrowRight, Eye, EyeOff, Globe2, Lock, Mail, ShieldAlert, Zap } from "lucide-react";
import { ApiError, authAPI, getErrorMessage } from "../../lib/services/api";
import { getDefaultPathForRole, getStoredUser, hasAuthSession } from "../../lib/auth/roleAccess";
import { toast } from "sonner";
import { AnimatedGISBackground } from "../components/Brand/AnimatedGISBackground";
import { BITEMAP_FONT_FAMILY, BITEMAP_LOGO_SRC } from "../components/Brand/brand";

const DEMO_MODE = false;
const GOOGLE_OAUTH_STATE_STORAGE_KEY = "bitemap_google_oauth_state";

function GoogleLogoIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}


export function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const processedOAuthCallbackRef = useRef(false);

  useEffect(() => {
    const user = getStoredUser();
    if (hasAuthSession() && user) {
      navigate(getDefaultPathForRole(user.role), { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (cooldownSeconds <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const oauthError = params.get("error");

    if (!code && !state && !oauthError) {
      return;
    }

    if (processedOAuthCallbackRef.current) {
      return;
    }
    processedOAuthCallbackRef.current = true;

    const expectedState = sessionStorage.getItem(GOOGLE_OAUTH_STATE_STORAGE_KEY) || localStorage.getItem(GOOGLE_OAUTH_STATE_STORAGE_KEY);
    sessionStorage.removeItem(GOOGLE_OAUTH_STATE_STORAGE_KEY);
    localStorage.removeItem(GOOGLE_OAUTH_STATE_STORAGE_KEY);

    window.history.replaceState({}, document.title, window.location.pathname);

    if (oauthError) {
      const message = oauthError === "access_denied"
        ? "Google sign-in was cancelled."
        : "Google sign-in failed. Please try again.";
      setAuthError(message);
      toast.error(message);
      return;
    }

    if (!code || !state) {
      const message = "Google sign-in response was incomplete. Please try again.";
      setAuthError(message);
      toast.error(message);
      return;
    }

    if (!expectedState || expectedState !== state) {
      const message = "Invalid or expired Google authentication state. Please try signing in again.";
      setAuthError(message);
      toast.error(message);
      return;
    }

    const completeGoogleSignIn = async () => {
      setAuthError(null);
      setIsGoogleLoading(true);
      try {
        const result = await authAPI.signInWithGoogle(code, state);
        if (result.success) {
          setCooldownSeconds(0);
          setAuthError(null);
          toast.success("Login successful!");
          navigate(getDefaultPathForRole(result.user?.role), { replace: true });
        } else {
          const message = result.error || "Google sign-in failed.";
          setAuthError(message);
          toast.error(message);
        }
      } catch (error: unknown) {
        if (
          error instanceof ApiError &&
          error.status === 403 &&
          error.code === "unregistered_google_account"
        ) {
          const verifiedEmail = typeof error.email === "string" ? error.email.trim() : "";
          const noticeMessage =
            "Your Google account is not registered with BITEMAP yet. Complete this access request to ask your clinic administrator for approval.";
          toast.info(noticeMessage);
          navigate("/request-account-approval", {
            replace: true,
            state: {
              googleUnregisteredEmail: verifiedEmail,
              googleUnregisteredNotice: noticeMessage,
            },
          });
          return;
        }

        if (error instanceof ApiError && error.status === 429) {
          const waitSeconds = error.retryAfter && error.retryAfter > 0 ? Math.ceil(error.retryAfter) : 60;
          setCooldownSeconds(waitSeconds);
        }
        const message = getErrorMessage(error, "Unable to complete Google sign-in.");
        setAuthError(message);
        toast.error(message);
      } finally {
        setIsGoogleLoading(false);
      }
    };

    void completeGoogleSignIn();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownSeconds > 0) {
      toast.error(`Please wait ${cooldownSeconds}s before trying to sign in again.`);
      return;
    }

    setAuthError(null);
    setIsLoading(true);
    try {
      const result = await authAPI.signIn(username.trim(), password);
      if (result.success) {
        setCooldownSeconds(0);
        setAuthError(null);
        toast.success("Login successful!");
        navigate(getDefaultPathForRole(result.user?.role));
      } else {
        const message = result.error || "Login failed. Please check your credentials.";
        setAuthError(message);
        toast.error(message);
      }
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 429) {
        const waitSeconds = error.retryAfter && error.retryAfter > 0 ? Math.ceil(error.retryAfter) : 60;
        setCooldownSeconds(waitSeconds);
      }
      const message = getErrorMessage(error, "An error occurred during login.");
      setAuthError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isLoading || isGoogleLoading) {
      return;
    }

    if (cooldownSeconds > 0) {
      toast.error(`Please wait ${cooldownSeconds}s before trying to sign in again.`);
      return;
    }

    setAuthError(null);
    setIsGoogleLoading(true);
    try {
      const result = await authAPI.getGoogleAuthUrl();
      if (result.success && typeof result.authUrl === "string" && result.authUrl.trim() !== "") {
        let oauthState = typeof result.state === "string" ? result.state.trim() : "";
        if (!oauthState) {
          try {
            oauthState = new URL(result.authUrl).searchParams.get("state") || "";
          } catch {
            oauthState = "";
          }
        }
        if (oauthState) {
          sessionStorage.setItem(GOOGLE_OAUTH_STATE_STORAGE_KEY, oauthState);
          localStorage.setItem(GOOGLE_OAUTH_STATE_STORAGE_KEY, oauthState);
        }
        window.location.assign(result.authUrl);
        return;
      }

      const message = result.error || "Unable to start Google sign-in.";
      setAuthError(message);
      toast.error(message);
      setIsGoogleLoading(false);
    } catch (error: unknown) {
      const message = getErrorMessage(error, "Unable to start Google sign-in.");
      setAuthError(message);
      toast.error(message);
      setIsGoogleLoading(false);
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
                {cooldownSeconds > 0 && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-[13px] font-semibold text-amber-900"
                  >
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <div>
                      <p>Login temporarily locked due to repeated failed attempts.</p>
                      <p className="mt-0.5 text-[12px] font-medium text-amber-800">
                        Please wait {cooldownSeconds} second{cooldownSeconds === 1 ? "" : "s"} before trying again.
                      </p>
                    </div>
                  </div>
                )}

                {authError && cooldownSeconds <= 0 && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left text-[13px] font-semibold text-rose-900"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    <p>{authError}</p>
                  </div>
                )}

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
                  disabled={isLoading || isGoogleLoading || cooldownSeconds > 0}
                  className="relative h-12 w-full rounded-full border border-transparent bg-gradient-to-r from-teal-800 to-teal-600 text-[15px] font-extrabold text-white shadow-lg shadow-teal-900/20 transition-colors hover:from-teal-900 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/35 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                      Signing in...
                    </span>
                  ) : cooldownSeconds > 0 ? (
                    <span>Wait {cooldownSeconds}s to Retry</span>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2" />
                    </>
                  )}
                </button>

                <div className="relative my-4 flex items-center">
                  <div className="flex-grow border-t border-slate-200" />
                  <span className="mx-3 shrink-0 text-[12px] font-semibold uppercase tracking-wider text-slate-400">
                    or
                  </span>
                  <div className="flex-grow border-t border-slate-200" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading || isGoogleLoading || cooldownSeconds > 0}
                  className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-slate-200 bg-white px-5 text-[15px] font-bold text-slate-700 shadow-sm shadow-slate-900/5 transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-500/35 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isGoogleLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-700" />
                      Connecting to Google...
                    </span>
                  ) : (
                    <>
                      <GoogleLogoIcon />
                      <span>Continue with Google</span>
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
