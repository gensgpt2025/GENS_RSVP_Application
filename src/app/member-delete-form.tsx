"use client";

import type { Member } from "@/lib/types";

type MemberDeleteFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  members: Member[];
};

export function MemberDeleteForm({ action, members }: MemberDeleteFormProps) {
  return (
    <form
      action={action}
      className="stack-form member-control-form"
      onSubmit={(event) => {
        const form = event.currentTarget;
        const selected = form.elements.namedItem("member_id") as HTMLSelectElement | null;
        const memberName = selected?.selectedOptions[0]?.textContent?.trim() || "選択したメンバー";
        const confirmed = window.confirm(`「${memberName}」を削除しますか？\nこの操作は取り消せません。`);
        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <label>
        <span>削除するメンバー</span>
        <select name="member_id" required defaultValue="">
          <option value="" disabled>
            メンバーを選択
          </option>
          {members.map((member) => (
            <option value={member.id} key={member.id}>
              {member.name}
            </option>
          ))}
        </select>
      </label>
      <button className="danger-button" type="submit">
        メンバーを削除
      </button>
    </form>
  );
}
