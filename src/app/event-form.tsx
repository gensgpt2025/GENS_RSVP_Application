"use client";

import { useMemo, useState } from "react";
import { CalendarPlus } from "lucide-react";

const categories = ["練習試合", "県リーグ", "トレーニング", "イベント"];
const hourOptions = Array.from({ length: 24 }, (_, hour) => hour.toString().padStart(2, "0"));
const minuteOptions = ["00", "10", "20", "30", "40", "50"];

function splitTime(value?: string) {
  const [hour = "", minute = ""] = (value ?? "").split(":");
  return { hour, minute };
}

type EventFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  buttonLabel: string;
  requireAdminPasscode?: boolean;
  defaults?: {
    id?: string;
    category?: string;
    opponent?: string;
    eventDate?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
    description?: string;
  };
};

export function EventForm({ action, buttonLabel, requireAdminPasscode = true, defaults }: EventFormProps) {
  const initialCategory = defaults?.category && categories.includes(defaults.category) ? defaults.category : categories[0];
  const [category, setCategory] = useState(initialCategory);
  const needsOpponent = useMemo(() => category === "練習試合" || category === "県リーグ", [category]);
  const start = splitTime(defaults?.startTime);
  const end = splitTime(defaults?.endTime);

  return (
    <form action={action} className="stack-form">
      {defaults?.id ? <input type="hidden" name="event_id" value={defaults.id} /> : null}

      <label>
        <span>日付</span>
        <input name="event_date" type="date" defaultValue={defaults?.eventDate ?? ""} required />
      </label>

      <label>
        <span>開始時間</span>
        <div className="time-picker-row">
          <select name="start_hour" defaultValue={start.hour} required>
            <option value="" disabled>
              時
            </option>
            {hourOptions.map((hour) => (
              <option value={hour} key={hour}>
                {hour}時
              </option>
            ))}
          </select>
          <select name="start_minute" defaultValue={start.minute} required>
            <option value="" disabled>
              分
            </option>
            {minuteOptions.map((minute) => (
              <option value={minute} key={minute}>
                {minute}分
              </option>
            ))}
          </select>
        </div>
      </label>

      <label>
        <span>終了時間</span>
        <div className="time-picker-row">
          <select name="end_hour" defaultValue={end.hour} required>
            <option value="" disabled>
              時
            </option>
            {hourOptions.map((hour) => (
              <option value={hour} key={hour}>
                {hour}時
              </option>
            ))}
          </select>
          <select name="end_minute" defaultValue={end.minute} required>
            <option value="" disabled>
              分
            </option>
            {minuteOptions.map((minute) => (
              <option value={minute} key={minute}>
                {minute}分
              </option>
            ))}
          </select>
        </div>
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
