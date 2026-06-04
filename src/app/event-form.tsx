"use client";

import { useMemo, useState } from "react";
import { CalendarPlus } from "lucide-react";

const categories = ["練習試合", "県リーグ", "トレーニング"];

type EventFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  buttonLabel: string;
  requireAdminPasscode?: boolean;
  defaults?: {
    id?: string;
    category?: string;
    opponent?: string;
    startDatetime?: string;
    endDatetime?: string;
    location?: string;
    description?: string;
  };
};

export function EventForm({ action, buttonLabel, requireAdminPasscode = true, defaults }: EventFormProps) {
  const initialCategory = defaults?.category && categories.includes(defaults.category) ? defaults.category : categories[0];
  const [category, setCategory] = useState(initialCategory);
  const needsOpponent = useMemo(() => category === "練習試合" || category === "県リーグ", [category]);

  return (
    <form action={action} className="stack-form">
      {defaults?.id ? <input type="hidden" name="event_id" value={defaults.id} /> : null}

      <label>
        <span>開始日時</span>
        <input name="start_datetime" type="datetime-local" defaultValue={defaults?.startDatetime ?? ""} required />
      </label>

      <label>
        <span>終了日時</span>
        <input name="end_datetime" type="datetime-local" defaultValue={defaults?.endDatetime ?? ""} required />
      </label>

      <label>
        <span>内容</span>
        <select name="category" value={category} onChange={(event) => setCategory(event.target.value)} required>
          {categories.map((item) => (
            <option value={item} key={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      {needsOpponent ? (
        <label>
          <span>対戦相手</span>
          <input name="opponent" defaultValue={defaults?.opponent ?? ""} required />
        </label>
      ) : null}

      <label>
        <span>場所</span>
        <input name="location" defaultValue={defaults?.location ?? ""} />
      </label>

      <label>
        <span>詳細</span>
        <textarea name="description" rows={4} defaultValue={defaults?.description ?? ""} />
      </label>

      {requireAdminPasscode ? (
        <label>
          <span>管理者パスコード</span>
          <input name="admin_passcode" type="password" autoComplete="current-password" required />
        </label>
      ) : null}

      <button className="primary-button" type="submit">
        <CalendarPlus size={18} />
        {buttonLabel}
      </button>
    </form>
  );
}
