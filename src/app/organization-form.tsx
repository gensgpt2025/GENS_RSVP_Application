"use client";

import { useActionState } from "react";
import { Building2 } from "lucide-react";
import { createOrganizationAction, type OrganizationFormState } from "@/app/actions";

const initialState: OrganizationFormState = {
  message: "",
};

export function OrganizationForm() {
  const [state, action, pending] = useActionState(createOrganizationAction, initialState);

  return (
    <details className="organization-create-panel">
      <summary>団体を作成</summary>
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
          <span>最初の管理者名</span>
          <input name="admin_name" defaultValue="管理者" required />
        </label>
        <label>
          <span>管理者パスコード</span>
          <input name="admin_passcode" type="password" autoComplete="new-password" required />
        </label>
        {state.message ? <p className="form-message">{state.message}</p> : null}
        <button className="secondary-button" type="submit" disabled={pending}>
          <Building2 size={18} />
          作成
        </button>
      </form>
    </details>
  );
}
