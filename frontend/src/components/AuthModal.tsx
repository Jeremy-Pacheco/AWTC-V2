import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AtSymbolIcon,
  LockClosedIcon,
  UserIcon,
  EyeIcon,
  EyeSlashIcon,
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
      if (!res.ok) throw new Error(data.message || "Invalid username or password");

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
      if (!res.ok) throw new Error(data.message || "Error creating user");

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

  return (
    <AnimatePresence mode="wait">
      {open && (
        <motion.div
          key="auth-modal"
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
        >
          <motion.div
            className="relative bg-white rounded-2xl shadow-xl w-[90%] max-w-sm p-6 text-gray-800"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ duration: 0.3, type: "spring", stiffness: 120 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="absolute top-3 right-4 text-gray-500 text-2xl hover:text-gray-700 transition"
              onClick={onClose}
            >
              ✕
            </button>

            <h2 className="text-2xl font-semibold mb-4 text-center">
              {currentMode === "login" ? "Log In" : "Sign Up"}
            </h2>

            <form
              className="space-y-4"
              onSubmit={currentMode === "login" ? handleLogin : handleSignup}
            >
              {currentMode === "signup" && (
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-400 outline-none"
                    required
                  />
                </div>
              )}

              <div className="relative">
                <AtSymbolIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-400 outline-none"
                  required
                />
              </div>

              <div className="relative">
                <LockClosedIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="Password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-brand-400 outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>

              <button
                type="submit"
                className="w-full bg-brand text-black py-2 rounded-3xl hover:bg-ink hover:text-white transition font-semibold"
              >
                {currentMode === "login" ? "Log In" : "Sign Up"}
              </button>
            </form>

            {currentMode === "login" && demoConfig.enabled && demoConfig.accounts && demoConfig.accounts.length > 0 && (
              <div className="mt-5 rounded-xl border border-dashed border-brand bg-brand-50 p-3">
                <p className="text-sm font-semibold text-center">{t("demo.enterAs")}</p>
                <p className="text-xs text-gray-600 text-center mt-1 mb-3">{t("demo.enterAsHint")}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {demoConfig.accounts.map((account) => (
                    <button
                      key={account.role}
                      type="button"
                      onClick={() => handleDemoLogin(account.role)}
                      disabled={demoLoading !== null}
                      className="rounded-3xl border border-ink px-3 py-1.5 text-sm font-medium hover:bg-ink hover:text-white transition disabled:opacity-50 disabled:cursor-wait"
                    >
                      {demoLoading === account.role ? t("demo.signingIn") : t(`demo.roles.${account.role}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-center text-sm mt-4 text-gray-600">
              {currentMode === "login" ? (
                <>
                  Don’t have an account?{" "}
                  <button
                    onClick={() => setCurrentMode("signup")}
                    className="text-brand-text hover:underline"
                  >
                    Sign Up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    onClick={() => setCurrentMode("login")}
                    className="text-brand-text hover:underline"
                  >
                    Log In
                  </button>
                </>
              )}
            </p>
          </motion.div>
        </motion.div>
      )}
      <AlertModal open={alertOpen} message={alertMessage} onAccept={() => setAlertOpen(false)} />
    </AnimatePresence>
  );
};

export default AuthModal;
