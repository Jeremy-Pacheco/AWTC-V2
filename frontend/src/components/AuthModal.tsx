import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AtSymbolIcon,
  LockClosedIcon,
  UserIcon,
  EyeIcon,
  EyeSlashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import AlertModal from "./AlertModal";
import { errorMessage } from "../types/api";
import { getDemoConfig, loginAsDemo, type DemoConfig, type DemoRole } from "../utils/demo";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface AuthModalProps {
  open: boolean;
  mode: "login" | "signup";
  onClose: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ open, mode, onClose }) => {
  const [currentMode, setCurrentMode] = useState<"login" | "signup">(mode);
  const [showPass, setShowPass] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  // Form state
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");

  // Demo mode: one-click access to the shared demo accounts
  const { t } = useTranslation();
  const [demoConfig, setDemoConfig] = useState<DemoConfig>({ enabled: false });
  const [demoLoading, setDemoLoading] = useState<DemoRole | null>(null);

  useEffect(() => {
    if (open) {
      setCurrentMode(mode);
      setEmail("");
      setPass("");
      setName("");
      getDemoConfig().then(setDemoConfig);
    }
  }, [open, mode]);

  const handleDemoLogin = async (role: DemoRole) => {
    setDemoLoading(role);
    try {
      await loginAsDemo(role);
      onClose();
    } catch (err) {
      setAlertMessage(err instanceof Error ? err.message : String(err));
      setAlertOpen(true);
    } finally {
      setDemoLoading(null);
    }
  };

  // LOGIN
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Encode as UTF-8 first: plain btoa() throws on characters like "ñ" or accents
      const tokenBasic = btoa(String.fromCharCode(...new TextEncoder().encode(`${email}:${pass}`)));
      const res = await fetch(`${API_URL}/api/users/login`, {
        method: "POST",
        credentials: "include", // receive the httpOnly refresh cookie
        headers: { Authorization: `Basic ${tokenBasic}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t("auth.invalidCredentials", "Invalid username or password"));

      localStorage.setItem("jwtToken", data.access_token);
      localStorage.setItem("userName", data.user.name);
      localStorage.setItem("userRole", data.user.role);

      // Notify other components
      window.dispatchEvent(new CustomEvent("authChanged", { detail: { loggedIn: true } }));
      try { localStorage.setItem("__auth_last_update", Date.now().toString()); } catch { /* storage unavailable (private mode) */ }

      onClose();
    } catch (err) {
      setAlertMessage(errorMessage(err));
      setAlertOpen(true);
    }
  };

  // SIGNUP
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/users/signup`, {
        method: "POST",
        credentials: "include", // receive the httpOnly refresh cookie
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password: pass }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t("auth.signupError", "Error creating user"));

      localStorage.setItem("jwtToken", data.access_token);
      localStorage.setItem("userName", data.user.name);
      localStorage.setItem("userRole", data.user.role);

      // Notify other components
      window.dispatchEvent(new CustomEvent("authChanged", { detail: { loggedIn: true } }));
      try { localStorage.setItem("__auth_last_update", Date.now().toString()); } catch { /* storage unavailable (private mode) */ }

      // The new account is already signed in (token stored above): close the
      // modal instead of showing the login form again (BUG-08)
      onClose();
    } catch (err) {
      setAlertMessage(errorMessage(err));
      setAlertOpen(true);
    }
  };

  const isLogin = currentMode === "login";
  const field =
    "w-full rounded-xl border border-gray-300 bg-[var(--card-bg)] py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25";
  const showDemo = isLogin && demoConfig.enabled && demoConfig.accounts && demoConfig.accounts.length > 0;

  return (
    <AnimatePresence mode="wait">
      {open && (
        <motion.div
          key="auth-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-[var(--card-bg)] shadow-2xl"
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            transition={{ duration: 0.25, type: "spring", stiffness: 160, damping: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1.5 bg-gradient-to-r from-brand-400 via-brand to-brand-700" />
            <button
              type="button"
              className="absolute right-4 top-5 grid h-9 w-9 place-items-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
              onClick={onClose}
              aria-label={t("auth.close", "Close")}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>

            <div className="p-6 sm:p-8">
              <h2 id="auth-modal-title" className="text-2xl font-bold tracking-tight">
                {isLogin ? t("auth.loginTitle", "Welcome back") : t("auth.signupTitle", "Create your account")}
              </h2>
              <p className="mt-1 text-left text-sm text-gray-600">
                {isLogin ? t("auth.loginSubtitle", "Sign in to sign up for projects.") : t("auth.signupSubtitle", "It only takes a minute.")}
              </p>

              <form className="mt-6 space-y-4" onSubmit={isLogin ? handleLogin : handleSignup}>
                {!isLogin && (
                  <div className="relative">
                    <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder={t("auth.fullName", "Full Name")}
                      aria-label={t("auth.fullName", "Full Name")}
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={field}
                      required
                    />
                  </div>
                )}

                <div className="relative">
                  <AtSymbolIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    placeholder={t("auth.email", "Email")}
                    aria-label={t("auth.email", "Email")}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={field}
                    required
                  />
                </div>

                <div className="relative">
                  <LockClosedIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPass ? "text" : "password"}
                    placeholder={t("auth.password", "Password")}
                    aria-label={t("auth.password", "Password")}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    className={`${field} !pr-11`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    aria-label={showPass ? t("auth.hidePassword", "Hide password") : t("auth.showPassword", "Show password")}
                    className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-gray-400 hover:text-gray-700"
                  >
                    {showPass ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-full bg-brand py-2.5 font-semibold text-on-brand shadow-sm transition-colors hover:bg-brand-hover"
                >
                  {isLogin ? t("auth.login", "Log In") : t("auth.signup", "Sign Up")}
                </button>
              </form>

              {showDemo && (
                <div className="mt-6">
                  <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-widest text-gray-400">
                    <span className="h-px flex-1 bg-gray-200" />
                    {t("demo.enterAs")}
                    <span className="h-px flex-1 bg-gray-200" />
                  </div>
                  <p className="mt-2 text-center text-xs text-gray-500">{t("demo.enterAsHint")}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {demoConfig.accounts!.map((account) => (
                      <button
                        key={account.role}
                        type="button"
                        onClick={() => handleDemoLogin(account.role)}
                        disabled={demoLoading !== null}
                        className="rounded-xl border border-gray-200 px-2 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-brand hover:bg-brand-50 hover:text-brand-text disabled:cursor-wait disabled:opacity-50"
                      >
                        {demoLoading === account.role ? t("demo.signingIn") : t(`demo.roles.${account.role}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="mt-6 text-center text-sm text-gray-600">
                {isLogin ? t("auth.noAccount", "Don’t have an account?") : t("auth.haveAccount", "Already have an account?")}{" "}
                <button
                  type="button"
                  onClick={() => setCurrentMode(isLogin ? "signup" : "login")}
                  className="font-semibold text-brand-text hover:underline"
                >
                  {isLogin ? t("auth.signup", "Sign Up") : t("auth.login", "Log In")}
                </button>
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
      <AlertModal open={alertOpen} message={alertMessage} onAccept={() => setAlertOpen(false)} />
    </AnimatePresence>
  );
};

export default AuthModal;
