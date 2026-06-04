"use client";

type EventDeleteFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
  eventTitle: string;
};

export function EventDeleteForm({ action, eventId, eventTitle }: EventDeleteFormProps) {
  return (
    <form
      action={action}
      className="admin-inline-form"
      onSubmit={(event) => {
        const confirmed = window.confirm(`「${eventTitle}」を削除しますか？\nこの操作は取り消せません。`);
        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="event_id" value={eventId} />
      <label>
        <span>管理者パスコード</span>
        <input name="admin_passcode" type="password" autoComplete="current-password" required />
      </label>
      <button className="danger-button" type="submit">
        予定を削除
      </button>
    </form>
  );
}
