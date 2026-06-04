"use client";

import { useActionState } from "react";
import { Building2 } from "lucide-react";
import { createOrganizationAction, type OrganizationFormState } from "@/app/actions";

const initialState: OrganizationFormState = {
  message: "",
};

type OrganizationFormProps = {
  embedded?: boolean;
};

export function OrganizationForm({ embedded = false }: OrganizationFormProps) {
  const [state, action, pending] = useActionState(createOrganizationAction, initialState);

  const content = (
      <form action={action} className="stack-form">
        <label>
          <span>団体名</span>
          <input name="organization_name" required />
        </label>
        <label>
          <span>団体コード</span>
          <input name="organization_code" placeholder="GENS" required />
        </label>
        <label>
          <span>初期メンバー名</span>
          <input name="admin_name" defaultValue="メンバー" required />
        </label>
        <label>
          <span>サイト管理者ID</span>
          <input name="site_admin_username" defaultValue="sugaya" autoComplete="username" required />
        </label>
        <label>
          <span>サイト管理者パスワード</span>
          <input name="site_admin_password" type="password" autoComplete="current-password" required />
        </label>
        {state.message ? <p className="form-message">{state.message}</p> : null}
        <button className="secondary-button" type="submit" disabled={pending}>
          <Building2 size={18} />
          作成
        </button>
      </form>
  );

  if (embedded) {
    return (
      <section className="embedded-overview">
        <h3>団体を作成</h3>
        {content}
      </section>
    );
  }

  return (
    <details className="organization-create-panel">
      <summary>団体を作成</summary>
      {content}
    </details>
  );
}
