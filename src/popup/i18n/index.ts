import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ru from './locales/ru.json'
import zh from './locales/zh.json'
import fr from './locales/fr.json'
import tr from './locales/tr.json'
import de from './locales/de.json'
import es from './locales/es.json'
import pt from './locales/pt.json'

// Get saved language from storage or default to English
const getSavedLanguage = (): string => {
  try {
    return localStorage.getItem('aetron_language') || 'en'
  } catch {
    return 'en'
  }
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
    zh: { translation: zh },
    fr: { translation: fr },
    tr: { translation: tr },
    de: { translation: de },
    es: { translation: es },
    pt: { translation: pt }
  },
  lng: getSavedLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false
  }
})

// Save language to localStorage when changed
export const changeLanguage = (lng: string) => {
  localStorage.setItem('aetron_language', lng)
  i18n.changeLanguage(lng)
}

export const languages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' }
]

export default i18n
