"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import {
  changeOrganizationCodeAction,
  type OrganizationCodeFormState,
} from "@/app/actions";

const initialState: OrganizationCodeFormState = {
  message: "",
  success: false,
};

export function OrganizationCodeForm() {
  const [state, action, pending] = useActionState(changeOrganizationCodeAction, initialState);

  return (
    <section className="embedded-overview">
      <h3>団体コード変更</h3>
      <p className="warning-message">
        変更すると旧コードでは入室できなくなり、この団体に入室中のメンバーは全員ログアウトします。
        新しいコードをメンバーへ案内し、変更後に新しいバックアップを保存してください。
      </p>
      <form action={action} className="stack-form">
        <label>
          <span>現在の団体コード</span>
          <input name="current_organization_code" autoCapitalize="characters" required />
        </label>
        <label>
          <span>新しい団体コード</span>
          <input
            name="new_organization_code"
            autoCapitalize="characters"
            minLength={3}
            maxLength={24}
            pattern="[A-Za-z0-9_-]{3,24}"
            required
          />
        </label>
        <label>
          <span>新しい団体コード確認</span>
          <input
            name="confirmation_organization_code"
            autoCapitalize="characters"
            minLength={3}
            maxLength={24}
            pattern="[A-Za-z0-9_-]{3,24}"
            required
          />
        </label>
        <label>
          <span>サイト管理者ID</span>
          <input name="site_admin_username" defaultValue="sugaya" autoComplete="username" required />
        </label>
        <label>
          <span>サイト管理者パスワード</span>
          <input name="site_admin_password" type="password" autoComplete="current-password" required />
        </label>
        {state.message ? (
          <p className={state.success ? "success-message" : "form-message"}>{state.message}</p>
        ) : null}
        <button className="secondary-button" type="submit" disabled={pending}>
          <RefreshCw size={18} />
          {pending ? "変更中..." : "団体コードを変更"}
        </button>
      </form>
    </section>
  );
}
