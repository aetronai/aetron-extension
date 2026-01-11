import { 
  getPasswordStrength, 
  validatePassword,
  PASSWORD_ERROR_MESSAGES,
  PASSWORD_STRENGTH_LABELS
} from '../../shared/utils/validation'

interface PasswordStrengthIndicatorProps {
  password: string
  showErrors?: boolean
}

export function PasswordStrengthIndicator({ password, showErrors = true }: PasswordStrengthIndicatorProps) {
  if (!password) return null

  const { level, label, color } = getPasswordStrength(password)
  const { errors } = validatePassword(password)

  return (
    <div className="mt-2 space-y-1">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300 rounded-full"
            style={{
              width: `${(level + 1) * 25}%`,
              backgroundColor: color
            }}
          />
        </div>
        <span className="text-xs font-medium min-w-[60px]" style={{ color }}>
          {PASSWORD_STRENGTH_LABELS[label]}
        </span>
      </div>

      {/* Validation errors */}
      {showErrors && errors.length > 0 && (
        <div className="text-xs text-gray-400 space-y-0.5">
          {errors.map((error, index) => (
            <div key={index} className="flex items-center gap-1">
              <span className="text-red-400">•</span>
              <span>{PASSWORD_ERROR_MESSAGES[error]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default PasswordStrengthIndicator
