import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import ru from './locales/ru.json'
import zh from './locales/zh.json'

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
    zh: { translation: zh }
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
  { code: 'zh', name: 'Chinese', nativeName: '中文' }
]

export default i18n
