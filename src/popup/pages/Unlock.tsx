import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Button, Input } from "../components/ui";
import { useWallet } from "../context/WalletContext";
import * as messaging from "@lib/messaging";

export default function Unlock() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { activeWallet, unlockWallet, refreshWallets } = useWallet();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWallet || !password) return;

    setIsLoading(true);
    setError("");

    try {
      const success = await unlockWallet(activeWallet.id, password);
      if (success) {
        navigate("/");
      } else {
        setError(t("unlock.wrongPassword"));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    try {
      await messaging.clearAllWallets();
      await refreshWallets();
      navigate("/welcome");
    } catch (err) {
      console.error("Failed to reset wallets:", err);
    }
  };

  // Reset confirmation dialog
  if (showResetConfirm) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-dark-900 p-6">
        <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-red-500" />
        </div>

        <h1 className="text-xl font-bold text-white mb-2">
          {t("unlock.resetTitle")}
        </h1>
        <p className="text-gray-400 text-sm text-center mb-6">
          {t("unlock.resetWarning")}
        </p>

        <div className="w-full space-y-3">
          <Button
            onClick={handleForgotPassword}
            className="w-full !bg-red-500 hover:!bg-red-600"
          >
            {t("unlock.confirmReset")}
          </Button>
          <Button
            variant="secondary"
            onClick={() => setShowResetConfirm(false)}
            className="w-full"
          >
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-dark-900 p-6">
      <div className="w-16 h-16 bg-dark-800 rounded-2xl flex items-center justify-center mb-6 border border-dark-700">
        <Lock className="w-8 h-8 text-primary-500" />
      </div>

      <h1 className="text-xl font-bold text-white mb-2">{t("unlock.title")}</h1>
      <p className="text-gray-400 text-sm text-center mb-6">
        {t("unlock.subtitle")}
      </p>

      {activeWallet && (
        <div className="w-full p-3 bg-dark-800 rounded-lg border border-dark-700 mb-6">
          <p className="text-sm text-white font-medium">{activeWallet.name}</p>
          <p className="text-xs text-gray-500 font-mono truncate">
            {activeWallet.address}
          </p>
        </div>
      )}

      <form onSubmit={handleUnlock} className="w-full space-y-4">
        <Input
          type={showPassword ? "text" : "password"}
          placeholder={t("unlock.passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-gray-500 hover:text-gray-300"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          }
        />

        <Button type="submit" className="w-full" loading={isLoading}>
          {t("unlock.unlock")}
        </Button>
      </form>

      <button
        onClick={() => setShowResetConfirm(true)}
        className="mt-4 text-sm text-gray-400 hover:text-gray-100"
      >
        {t("unlock.forgotPassword")}
      </button>
    </div>
  );
}
