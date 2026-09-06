import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Globe, Sparkles, UserPlus, LogIn, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import { languages, translations } from "../mock";
import { useAuth } from "../context/AuthContext";
import { loginUser, registerUser } from "../lib/api";

const NetflixLogin = ({ onLoginSuccess }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [lang, setLang] = useState(languages[0]);

  // Get translation dictionary based on currently selected language
  const t = translations[lang.code] || translations.en;

  const validateEmail = (value) => {
    if (!value) return t.emailError || "Please enter a valid email.";
    // Accept standard email
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(value)) {
      return "Please enter a valid email address (e.g. yourname@gmail.com).";
    }
    return "";
  };

  const validatePassword = (value) => {
    if (!value || value.length < 4 || value.length > 60) {
      return t.passwordError || "Password must contain between 4 and 60 characters.";
    }
    return "";
  };

  const validateConfirmPassword = (value) => {
    if (isSignUp && value !== password) {
      return "Passwords do not match.";
    }
    return "";
  };

  const handleToggleMode = (mode) => {
    setIsSignUp(mode);
    setFormError("");
    setFormSuccess("");
    setEmailError("");
    setPasswordError("");
    setConfirmPasswordError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const eErr = validateEmail(email);
    const pErr = validatePassword(password);
    const cErr = isSignUp ? validateConfirmPassword(confirmPassword) : "";

    setEmailError(eErr);
    setPasswordError(pErr);
    setConfirmPasswordError(cErr);
    setFormError("");
    setFormSuccess("");

    if (eErr || pErr || cErr) return;

    setLoading(true);
    try {
      if (isSignUp) {
        // 1. Create account & save credentials in backend/data/credentials.json
        const registered = await registerUser(email, password);
        setFormSuccess("Account created successfully! Credentials saved. Logging you in...");
        login(registered.email);
        setTimeout(() => {
          if (onLoginSuccess) {
            onLoginSuccess(registered.email);
          } else {
            navigate("/dashboard");
          }
        }, 600);
      } else {
        // 2. Sign in using saved credentials
        const loggedIn = await loginUser(email, password);
        setFormSuccess("Logged in successfully! Redirecting...");
        login(loggedIn.email);
        setTimeout(() => {
          if (onLoginSuccess) {
            onLoginSuccess(loggedIn.email);
          } else {
            navigate("/dashboard");
          }
        }, 400);
      }
    } catch (err) {
      console.error("Auth error:", err);
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        (isSignUp ? "Account creation failed. Please try again." : "Sign in failed. Please check your credentials.");
      setFormError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-netflix flex flex-col justify-between">
      {/* Background image + gradient */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1611087968157-41fa023f8608?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHwzfHxtb3ZpZSUyMHBvc3RlcnN8ZW58MHx8fGJsYWNrfDE3ODg2NDcwMDJ8MA&ixlib=rb-4.1.0&q=85')",
        }}
      />
      {/* Top-bottom gradient overlay + center darkening */}
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.8) 100%)",
        }}
      />

      {/* Header */}
      <header className="relative z-10 px-4 sm:px-10 md:px-14 lg:px-16 pt-4 sm:pt-5">
        <a href="/" className="inline-flex items-center gap-2" aria-label="Alpha">
          <span
            className="text-[#E50914] font-black select-none"
            style={{
              fontSize: "clamp(1.75rem, 2.5vw, 2.5rem)",
              letterSpacing: "0.02em",
              textShadow: "0 2px 6px rgba(0,0,0,0.6)",
            }}
          >
            ALPHA
          </span>
        </a>
      </header>

      {/* Sign In / Create Account Card */}
      <main className="relative z-10 flex justify-center px-4 pt-6 sm:pt-4 pb-16">
        <div className="w-full max-w-[460px] bg-black/80 backdrop-blur-md rounded-md px-6 py-8 sm:px-12 sm:py-10 min-h-[560px] border border-white/10 shadow-2xl">
          
          {/* Mode Tabs */}
          <div className="flex bg-[#1f1f1f] p-1 rounded-md mb-6 border border-white/5">
            <button
              type="button"
              onClick={() => handleToggleMode(false)}
              className={`flex-1 py-2 text-sm font-semibold rounded transition-all flex items-center justify-center gap-2 ${
                !isSignUp
                  ? "bg-[#E50914] text-white shadow-md"
                  : "text-[#a3a3a3] hover:text-white"
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleMode(true)}
              className={`flex-1 py-2 text-sm font-semibold rounded transition-all flex items-center justify-center gap-2 ${
                isSignUp
                  ? "bg-[#E50914] text-white shadow-md"
                  : "text-[#a3a3a3] hover:text-white"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Account</span>
            </button>
          </div>

          <h1 className="text-white text-[1.85rem] font-bold mb-1">
            {isSignUp ? "Create an Account" : t.signIn}
          </h1>
          <p className="text-[#a3a3a3] text-xs mb-6">
            {isSignUp
              ? "Create your account with your email & password. Credentials will be securely saved."
              : "Use your registered email & password to access your pictures and dashboard."}
          </p>

          {/* Success Banner */}
          {formSuccess && (
            <div className="mb-4 p-3.5 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-sm flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <span>{formSuccess}</span>
            </div>
          )}

          {/* Error Banner */}
          {formError && (
            <div className="mb-4 p-3.5 rounded bg-[#e87c03]/20 border border-[#e87c03] text-[#fcd34d] text-sm flex flex-col gap-2">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-[#e87c03] shrink-0 mt-0.5" />
                <span className="leading-snug">{formError}</span>
              </div>
              {formError.toLowerCase().includes("no account found") && !isSignUp && (
                <button
                  type="button"
                  onClick={() => handleToggleMode(true)}
                  className="self-start text-xs font-semibold text-white bg-[#E50914] hover:bg-[#f6121d] px-3 py-1 rounded transition-colors"
                >
                  Create Account with this Email →
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Email input with floating label */}
            <div className="mb-4">
              <div className="relative">
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailError(validateEmail(email))}
                  className={`peer w-full h-[52px] pt-5 pb-1 px-5 bg-[#262626] text-white rounded text-base focus:outline-none focus:bg-[#333] placeholder-transparent transition-colors border ${
                    emailError ? "border-[#e87c03]" : "border-white/10 focus:border-white/40"
                  }`}
                  placeholder={t.emailPlaceholder}
                  autoComplete="email"
                />
                <label
                  htmlFor="email"
                  className={`absolute left-5 text-[#8c8c8c] transition-all duration-150 pointer-events-none ${
                    email
                      ? "top-1.5 text-xs"
                      : "top-1/2 -translate-y-1/2 text-base peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-xs"
                  }`}
                >
                  Email address (e.g. Gmail)
                </label>
              </div>
              {emailError && (
                <p className="mt-1 text-[#e87c03] text-[13px]">{emailError}</p>
              )}
            </div>

            {/* Password input */}
            <div className="mb-4">
              <div className="relative">
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => setPasswordError(validatePassword(password))}
                  className={`peer w-full h-[52px] pt-5 pb-1 px-5 bg-[#262626] text-white rounded text-base focus:outline-none focus:bg-[#333] placeholder-transparent transition-colors border ${
                    passwordError ? "border-[#e87c03]" : "border-white/10 focus:border-white/40"
                  }`}
                  placeholder={t.passwordPlaceholder}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                />
                <label
                  htmlFor="password"
                  className={`absolute left-5 text-[#8c8c8c] transition-all duration-150 pointer-events-none ${
                    password
                      ? "top-1.5 text-xs"
                      : "top-1/2 -translate-y-1/2 text-base peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-xs"
                  }`}
                >
                  Password (min. 4 characters)
                </label>
              </div>
              {passwordError && (
                <p className="mt-1 text-[#e87c03] text-[13px]">
                  {passwordError}
                </p>
              )}
            </div>

            {/* Confirm Password input (Sign Up mode only) */}
            {isSignUp && (
              <div className="mb-4">
                <div className="relative">
                  <input
                    type="password"
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => setConfirmPasswordError(validateConfirmPassword(confirmPassword))}
                    className={`peer w-full h-[52px] pt-5 pb-1 px-5 bg-[#262626] text-white rounded text-base focus:outline-none focus:bg-[#333] placeholder-transparent transition-colors border ${
                      confirmPasswordError ? "border-[#e87c03]" : "border-white/10 focus:border-white/40"
                    }`}
                    placeholder="Confirm Password"
                    autoComplete="new-password"
                  />
                  <label
                    htmlFor="confirmPassword"
                    className={`absolute left-5 text-[#8c8c8c] transition-all duration-150 pointer-events-none ${
                      confirmPassword
                        ? "top-1.5 text-xs"
                        : "top-1/2 -translate-y-1/2 text-base peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-xs"
                    }`}
                  >
                    Confirm Password
                  </label>
                </div>
                {confirmPasswordError && (
                  <p className="mt-1 text-[#e87c03] text-[13px]">
                    {confirmPasswordError}
                  </p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[46px] mt-4 bg-[#E50914] hover:bg-[#f6121d] text-white font-semibold rounded text-base transition-colors disabled:opacity-60 shadow-lg cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isSignUp ? "Creating Account..." : "Signing In..."}
                </span>
              ) : isSignUp ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  Create Account
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>

            {/* Remember me & Helper */}
            {!isSignUp && (
              <div className="flex items-center justify-between mt-4">
                <label className="flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="peer sr-only"
                  />
                  <span
                    className={`w-4 h-4 flex items-center justify-center mr-2 bg-[#404040] rounded-sm`}
                  >
                    {remember && (
                      <svg
                        viewBox="0 0 16 16"
                        className="w-3 h-3 fill-white"
                        aria-hidden="true"
                      >
                        <path d="M6.5 12.5L2 8l1.5-1.5L6.5 9.5 12.5 3.5 14 5z" />
                      </svg>
                    )}
                  </span>
                  <span className="text-[#a3a3a3] text-xs">{t.rememberMe}</span>
                </label>
                <span className="text-[#737373] text-xs">Remember credentials</span>
              </div>
            )}

            {/* Toggle Sign Up / Sign In text */}
            <div className="mt-6 pt-4 border-t border-white/10 text-[#a3a3a3] text-sm">
              {isSignUp ? (
                <p>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => handleToggleMode(false)}
                    className="text-white font-semibold hover:underline cursor-pointer"
                  >
                    Sign in here.
                  </button>
                </p>
              ) : (
                <p>
                  New to the platform?{" "}
                  <button
                    type="button"
                    onClick={() => handleToggleMode(true)}
                    className="text-white font-semibold hover:underline cursor-pointer"
                  >
                    Create an account now.
                  </button>
                </p>
              )}
            </div>

            {/* Developer Storage info badge */}
            <div className="mt-5 p-3 rounded bg-white/[0.04] border border-white/10 text-xs text-[#a3a3a3]">
              <div className="flex items-center gap-1.5 font-medium text-white/90 mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-red-500" />
                <span>Developer Storage Notice</span>
              </div>
              <p className="text-[11px] leading-relaxed text-[#888]">
                Credentials are automatically saved in <code className="text-zinc-300 bg-black/40 px-1 py-0.5 rounded">backend/data/credentials.json</code> so any client can log in without issues.
              </p>
            </div>

          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 bg-black/75 text-[#737373] px-6 sm:px-14 md:px-20 lg:px-32 py-8 mt-auto">
        <div className="max-w-6xl mx-auto">
          <p className="mb-5 text-sm">
            {t.questionsCall}{" "}
            <a href="tel:+916302783789" className="hover:underline">
              +91-6302783789
            </a>
          </p>

          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-y-3 gap-x-4 text-[13px] mb-6">
            {t.footerLinks.map((link) => (
              <li key={link}>
                <a href="#" className="hover:underline">
                  {link}
                </a>
              </li>
            ))}
          </ul>

          {/* Language selector */}
          <div className="relative inline-block mb-4 z-30">
            <button
              type="button"
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-2 px-3.5 py-2 bg-black/80 border border-[#444] text-white text-sm rounded-sm hover:border-[#888] transition-colors"
            >
              <Globe className="w-4 h-4 text-white" />
              <span>{lang.label}</span>
              <ChevronDown className="w-4 h-4 text-white" />
            </button>
            {showLangMenu && (
              <div className="absolute bottom-full mb-2 left-0 bg-[#161616] border border-[#444] rounded-sm min-w-[150px] z-50 shadow-2xl overflow-hidden py-1">
                {languages.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => {
                      setLang(l);
                      setShowLangMenu(false);
                    }}
                    className={`block w-full text-left px-4 py-2 text-sm transition-colors ${
                      lang.code === l.code
                        ? "bg-[#333] text-white font-medium"
                        : "text-[#ccc] hover:bg-[#222] hover:text-white"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default NetflixLogin;
