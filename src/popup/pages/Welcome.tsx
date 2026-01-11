import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Plus, Download, Globe, Check } from "lucide-react";
import { Button } from "../components/ui";
import { changeLanguage, languages } from "../i18n";
import { hasPendingWalletCreation } from "./CreateWallet";

export default function Welcome() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check for pending wallet creation and redirect
  useEffect(() => {
    if (hasPendingWalletCreation()) {
      navigate("/create-wallet", { replace: true });
    }
  }, [navigate]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowLangDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLanguageChange = (code: string) => {
    changeLanguage(code);
    setShowLangDropdown(false);
  };

  const currentLang =
    languages.find((l) => l.code === i18n.language) || languages[0];

  return (
    <div className="w-full h-full flex flex-col bg-background p-6">
      {/* Language Selector - Top Right */}
      <div className="flex justify-end mb-4">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowLangDropdown(!showLangDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover border border-border transition-colors"
          >
            <Globe className="w-4 h-4 text-muted" />
            <span className="text-sm text-foreground">
              {currentLang.nativeName}
            </span>
          </button>

          {showLangDropdown && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-surface border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors ${
                    i18n.language === lang.code
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-surface-hover"
                  }`}
                >
                  <span>{lang.nativeName}</span>
                  {i18n.language === lang.code && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content - Centered */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Logo */}
        <img
          src="/logo/aetron_logo.svg"
          alt="AETRON"
          className="h-16 w-auto mb-6"
        />

        <h1 className="text-2xl font-bold text-foreground mb-2">
          {t("welcome.title")}
        </h1>
        <p className="text-muted text-center mb-8">{t("welcome.subtitle")}</p>

        <div className="w-full space-y-3">
          <Button
            onClick={() => navigate("/create-wallet")}
            className="w-full"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            {t("welcome.createNew")}
          </Button>

          <Button
            onClick={() => navigate("/import-wallet")}
            variant="secondary"
            className="w-full"
            size="lg"
          >
            <Download className="w-5 h-5 mr-2" />
            {t("welcome.importExisting")}
          </Button>
        </div>

        <p className="text-xs text-muted text-center mt-8">
          {/*t('welcome.termsNotice')*/}
        </p>
      </div>
    </div>
  );
}
