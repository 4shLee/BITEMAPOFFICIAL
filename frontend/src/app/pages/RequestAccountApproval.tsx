import { useEffect, useState, useRef } from "react";
import { Link } from "react-router";
import { ArrowLeft, Check, ChevronDown, Eye, EyeOff, Globe2, ShieldCheck } from "lucide-react";
import { authAPI, getErrorMessage } from "../../lib/services/api";
import { ASSIGNABLE_ROLES } from "../../lib/auth/roleAccess";
import { toast } from "sonner";
import { AnimatedGISBackground } from "../components/Brand/AnimatedGISBackground";
import { BITEMAP_FONT_FAMILY, BITEMAP_LOGO_SRC } from "../components/Brand/brand";

const REQUESTABLE_ROLES = ASSIGNABLE_ROLES.filter((role) => role.value !== 'system_admin');

const initialRequestForm = {
  firstName: "",
  middleName: "",
  lastName: "",
  suffix: "",
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
        className={'flex w-full items-center justify-between rounded-lg border px-3 py-1.5 text-left [@media(max-height:760px)]:py-1 text-[13px] transition-colors focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 ' + (open ? 'border-teal-600 bg-white ring-2 ring-teal-500/20' : 'border-slate-200 bg-white/90')}
      >
        <span className={selectedRole ? 'font-medium text-slate-900' : 'text-slate-400'}>
          {selectedRole?.label || 'Select the role you are requesting'}
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
                className={'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[14px] font-semibold transition-colors ' + (selected ? 'bg-teal-50 text-teal-800' : 'text-slate-700 hover:bg-emerald-50 hover:text-teal-800')}
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

export function RequestAccountApproval() {
  const [requestForm, setRequestForm] = useState(initialRequestForm);
  const [showRequestPassword, setShowRequestPassword] = useState(false);
  const [isRequestSubmitting, setIsRequestSubmitting] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);

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
        {
          firstName: requestForm.firstName,
          middleName: requestForm.middleName,
          lastName: requestForm.lastName,
          suffix: requestForm.suffix,
        },
        requestForm.role,
        requestForm.phone.trim() || undefined
      );

      if (result.success) {
        setRequestSubmitted(true);
        setRequestForm(initialRequestForm);
        toast.success(result.message || "Account request submitted for System Administrator approval.");
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to submit account request."));
    } finally {
      setIsRequestSubmitting(false);
    }
  };

  return (
    <div
      className="relative isolate flex min-h-screen flex-col bg-slate-50 overflow-hidden"
      style={{
        fontFamily: BITEMAP_FONT_FAMILY,
      }}
    >
      <AnimatedGISBackground />

      <header className="relative z-10 flex-shrink-0 border-b border-slate-200/70 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-2 sm:px-8 [@media(max-height:640px)]:py-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={BITEMAP_LOGO_SRC} alt="BITEMAP logo" className="h-10 w-10 object-contain sm:h-12 sm:w-12 [@media(max-height:640px)]:h-8 [@media(max-height:640px)]:w-8" />
              <div>
                <h1 className="text-[21px] font-extrabold leading-tight text-teal-800 sm:text-[23px]">BITEMAP</h1>
                <p className="hidden text-[13px] font-medium leading-tight text-slate-500 sm:block">Animal Bite Incident Tracking and Vaccination Monitoring</p>
              </div>
            </div>
            <Link
              to="/public"
              className="inline-flex items-center gap-2 rounded-full border border-teal-700/35 bg-white px-4 py-2 text-[13px] font-extrabold text-teal-800 shadow-sm transition-colors hover:border-teal-700 hover:bg-teal-50 sm:px-5 sm:py-2.5 sm:text-[14px] [@media(max-height:640px)]:py-1.5"
            >
              <Globe2 className="h-4 w-4" />
              <span className="hidden sm:inline">Back to Public Portal</span>
              <span className="sm:hidden">Portal</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-4 py-2 sm:py-3 [@media(max-height:760px)]:py-1.5 [@media(max-height:640px)]:py-0.5">
        <section className="relative w-full max-w-[560px] rounded-[24px] border border-slate-100 bg-white/95 px-5 py-3.5 shadow-xl shadow-slate-200/50 backdrop-blur-md sm:px-6 sm:py-4 [@media(max-height:760px)]:py-2.5 [@media(max-height:640px)]:py-1.5 [@media(max-height:640px)]:px-4">
          <div className="mb-1.5 text-center [@media(max-height:760px)]:mb-1">
            <img src={BITEMAP_LOGO_SRC} alt="BITEMAP logo" className="mx-auto h-9 w-9 sm:h-10 sm:w-10 object-contain [@media(max-height:760px)]:h-8 [@media(max-height:760px)]:w-8" />
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
              <Link
                to="/login"
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-teal-700 px-4 text-[15px] font-bold text-white transition-colors hover:bg-teal-800"
              >
                Return to Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-2 text-center [@media(max-height:760px)]:mb-1.5 [@media(max-height:640px)]:mb-0.5">
                <h2 className="text-[21px] font-extrabold leading-tight text-slate-900 sm:text-[23px] [@media(max-height:640px)]:text-[19px]">Request Account Approval</h2>
                <p className="mt-0.5 text-[12px] font-medium text-slate-500 [@media(max-height:640px)]:hidden">Submit your details for authorized staff review.</p>
              </div>

              <form onSubmit={handleRequestSubmit} className="space-y-2.5 [@media(max-height:760px)]:space-y-1.5 [@media(max-height:640px)]:space-y-1">
                {/* Personal Information Section */}
                <div className="space-y-1.5 [@media(max-height:760px)]:space-y-1 [@media(max-height:640px)]:space-y-0.5">
                  <h3 className="text-[13px] font-semibold text-slate-500 [@media(max-height:760px)]:leading-tight">Personal Information</h3>
                  
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
                    <div>
                      <label className="mb-0.5 block text-[12px] font-semibold text-slate-800 [@media(max-height:760px)]:leading-tight">First Name</label>
                      <input
                        type="text"
                        autoComplete="given-name"
                        value={requestForm.firstName}
                        onChange={(e) => setRequestForm({ ...requestForm, firstName: e.target.value })}
                        required
                        placeholder="First name"
                        className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 [@media(max-height:760px)]:py-1 text-[13px] text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[12px] font-semibold text-slate-800 [@media(max-height:760px)]:leading-tight">Last Name</label>
                      <input
                        type="text"
                        autoComplete="family-name"
                        value={requestForm.lastName}
                        onChange={(e) => setRequestForm({ ...requestForm, lastName: e.target.value })}
                        required
                        placeholder="Last name"
                        className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 [@media(max-height:760px)]:py-1 text-[13px] text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
                    <div>
                      <label className="mb-0.5 block text-[12px] font-semibold text-slate-800 [@media(max-height:760px)]:leading-tight">Middle Name <span className="font-normal text-slate-400">(optional)</span></label>
                      <input
                        type="text"
                        autoComplete="additional-name"
                        value={requestForm.middleName}
                        onChange={(e) => setRequestForm({ ...requestForm, middleName: e.target.value })}
                        placeholder="Middle name"
                        className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 [@media(max-height:760px)]:py-1 text-[13px] text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[12px] font-semibold text-slate-800 [@media(max-height:760px)]:leading-tight">Suffix <span className="font-normal text-slate-400">(optional)</span></label>
                      <input
                        type="text"
                        autoComplete="honorific-suffix"
                        value={requestForm.suffix}
                        onChange={(e) => setRequestForm({ ...requestForm, suffix: e.target.value })}
                        placeholder="Jr., Sr., II, etc."
                        className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 [@media(max-height:760px)]:py-1 text-[13px] text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      />
                    </div>
                  </div>
                </div>

                {/* Account Information Section */}
                <div className="space-y-1.5 [@media(max-height:760px)]:space-y-1 [@media(max-height:640px)]:space-y-0.5">
                  <h3 className="text-[13px] font-semibold text-slate-500 [@media(max-height:760px)]:leading-tight">Account Information</h3>
                  
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
                    <div>
                      <label className="mb-0.5 block text-[12px] font-semibold text-slate-800 [@media(max-height:760px)]:leading-tight">Email</label>
                      <input
                        type="email"
                        value={requestForm.email}
                        onChange={(e) => setRequestForm({ ...requestForm, email: e.target.value })}
                        required
                        placeholder="Email address"
                        className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 [@media(max-height:760px)]:py-1 text-[13px] text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[12px] font-semibold text-slate-800 [@media(max-height:760px)]:leading-tight">Phone <span className="font-normal text-slate-400">(optional)</span></label>
                      <input
                        type="tel"
                        value={requestForm.phone}
                        onChange={(e) => setRequestForm({ ...requestForm, phone: e.target.value })}
                        placeholder="09XXXXXXXXX"
                        className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 [@media(max-height:760px)]:py-1 text-[13px] text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-0.5 block text-[12px] font-semibold text-slate-800 [@media(max-height:760px)]:leading-tight">Requested Role</label>
                    <RequestedRoleDropdown
                      value={requestForm.role}
                      onChange={(role) => setRequestForm({ ...requestForm, role })}
                    />
                    <p className="mt-0.5 text-[11px] leading-tight text-slate-500">Reviewed by an authorized clinic administrator.</p>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
                    <div>
                      <label className="mb-0.5 block text-[12px] font-semibold text-slate-800 [@media(max-height:760px)]:leading-tight">Password</label>
                      <div className="relative">
                        <input
                          type={showRequestPassword ? "text" : "password"}
                          value={requestForm.password}
                          onChange={(e) => setRequestForm({ ...requestForm, password: e.target.value })}
                          required
                          minLength={8}
                          placeholder="Password"
                          className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 [@media(max-height:760px)]:py-1 pr-10 text-[13px] text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
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
                      <p className="mt-0.5 text-[11px] leading-tight text-slate-500">Must be at least 8 characters.</p>
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[12px] font-semibold text-slate-800 [@media(max-height:760px)]:leading-tight">Confirm Password</label>
                      <input
                        type={showRequestPassword ? "text" : "password"}
                        value={requestForm.confirmPassword}
                        onChange={(e) => setRequestForm({ ...requestForm, confirmPassword: e.target.value })}
                        required
                        minLength={8}
                        placeholder="Repeat password"
                        className="w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 [@media(max-height:760px)]:py-1 text-[13px] text-slate-900 placeholder:text-slate-400 transition-colors focus:border-teal-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-1 [@media(max-height:640px)]:pt-0.5">
                  <button
                    type="submit"
                    disabled={isRequestSubmitting}
                    className="h-9 sm:h-10 w-full rounded-full border border-transparent bg-gradient-to-r from-teal-800 to-teal-600 text-[14px] font-extrabold text-white shadow-lg shadow-teal-900/20 transition-colors hover:from-teal-900 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/35 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 [@media(max-height:640px)]:h-8"
                  >
                    {isRequestSubmitting ? "Submitting..." : "Submit Request"}
                  </button>
                  
                  <div className="mt-1.5 text-center [@media(max-height:640px)]:mt-1">
                    <Link
                      to="/login"
                      className="inline-flex items-center text-[13px] font-medium text-slate-500 transition-colors hover:text-teal-700 focus:outline-none"
                    >
                      <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                      Back to Sign In
                    </Link>
                  </div>
                </div>
              </form>
              
              <p className="mt-2 text-center text-[11px] font-medium text-slate-400 [@media(max-height:640px)]:hidden">
                Account requests are reviewed by authorized clinic administrators.
              </p>
            </>
          )}
        </section>
      </main>

      <footer className="relative z-10 flex-shrink-0 border-t border-transparent bg-transparent">
        <div className="mx-auto max-w-7xl px-6 py-1.5 sm:py-2 [@media(max-height:760px)]:py-1 [@media(max-height:640px)]:py-0.5">
          <div className="text-center text-[12px] sm:text-[13px] font-semibold text-white drop-shadow">
            <p>© 2026 BITEMAP Capstone Project - Cor Jesu College</p>
          </div>
        </div>
      </footer>
    </div>
  );
}


