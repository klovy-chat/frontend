import { useTranslation } from "react-i18next";

export function AdminBrand() {
  const { t } = useTranslation();

  return (
    <div className="adm-brand">
      <div className="adm-brand__title">{t("admin.brand.title")}</div>
    </div>
  );
}
