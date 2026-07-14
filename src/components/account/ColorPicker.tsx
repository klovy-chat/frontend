import { useTranslation } from "react-i18next";

interface ColorPickerProps {
  value: number;
  onChange: (color: number) => void;
}

const COLORS = [0, 1, 2, 3];

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const { t } = useTranslation();

  return (
    <div className="color-picker">
      <div
        className="color-options"
        role="group"
        aria-label={t("profile.form.avatarColor")}
      >
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`color-dot ${value === c ? "selected" : ""}`}
            data-color={c}
            onClick={() => onChange(c)}
            aria-label={t("profile.form.avatarColorOption", { index: c + 1 })}
            aria-pressed={value === c}
          />
        ))}
      </div>
    </div>
  );
}
