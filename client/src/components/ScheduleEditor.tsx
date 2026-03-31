import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

type Frequency = "daily" | "weekly" | "monthly" | "off";

const DAYS_OF_WEEK = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

const DAYS_OF_MONTH = Array.from({ length: 28 }, (_, i) => i + 1);

interface ScheduleEditorProps {
  brandId: string;
  initialFrequency?: Frequency;
  initialPostTime?: string;
  initialPostDays?: string[] | number[];
  onSaved?: () => void;
}

export function ScheduleEditor({
  brandId,
  initialFrequency = "daily",
  initialPostTime = "09:00",
  initialPostDays,
  onSaved,
}: ScheduleEditorProps) {
  const { isAuthenticated } = useAuth();
  const [frequency, setFrequency] = useState<Frequency>(initialFrequency);
  const [postTime, setPostTime] = useState(initialPostTime);
  const [selectedDays, setSelectedDays] = useState<string[]>(
    Array.isArray(initialPostDays) && typeof initialPostDays[0] === "string"
      ? (initialPostDays as string[])
      : ["mon", "wed", "fri"]
  );
  const [selectedMonthDays, setSelectedMonthDays] = useState<number[]>(
    Array.isArray(initialPostDays) && typeof initialPostDays[0] === "number"
      ? (initialPostDays as number[])
      : [1, 15]
  );

  const utils = trpc.useUtils();
  const updateSchedule = trpc.brands.updateSchedule.useMutation({
    onSuccess: () => {
      toast.success("Schedule saved");
      utils.brands.list.invalidate();
      utils.brands.get.invalidate({ brandId });
      onSaved?.();
    },
    onError: (err) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  function toggleWeekDay(day: string) {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function toggleMonthDay(day: number) {
    setSelectedMonthDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  function handleSave() {
    if (!isAuthenticated) {
      toast.error("You must be logged in to change schedules");
      return;
    }
    const postDays =
      frequency === "weekly"
        ? selectedDays
        : frequency === "monthly"
        ? selectedMonthDays
        : undefined;

    updateSchedule.mutate({ brandId, frequency, postTime, postDays });
  }

  return (
    <div className="schedule-editor">
      {/* Frequency selector */}
      <div className="schedule-row">
        <span className="schedule-label">FREQUENCY</span>
        <div className="freq-buttons">
          {(["daily", "weekly", "monthly", "off"] as Frequency[]).map((f) => (
            <button
              key={f}
              className={`freq-btn${frequency === f ? " active" : ""}`}
              onClick={() => setFrequency(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Time override — always shown unless off */}
      {frequency !== "off" && (
        <div className="schedule-row">
          <span className="schedule-label">POST TIME</span>
          <input
            type="time"
            value={postTime}
            onChange={(e) => setPostTime(e.target.value)}
            className="time-input"
          />
          <span className="schedule-hint">local time</span>
        </div>
      )}

      {/* Day of week — weekly only */}
      {frequency === "weekly" && (
        <div className="schedule-row schedule-row--wrap">
          <span className="schedule-label">DAYS</span>
          <div className="day-grid">
            {DAYS_OF_WEEK.map(({ key, label }) => (
              <button
                key={key}
                className={`day-btn${selectedDays.includes(key) ? " active" : ""}`}
                onClick={() => toggleWeekDay(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Day of month — monthly only */}
      {frequency === "monthly" && (
        <div className="schedule-row schedule-row--wrap">
          <span className="schedule-label">DAYS OF MONTH</span>
          <div className="month-grid">
            {DAYS_OF_MONTH.map((d) => (
              <button
                key={d}
                className={`day-btn day-btn--sm${selectedMonthDays.includes(d) ? " active" : ""}`}
                onClick={() => toggleMonthDay(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Off state message */}
      {frequency === "off" && (
        <div className="schedule-row">
          <span className="schedule-hint schedule-hint--warn">
            This brand will not post automatically. Use "Run Pipeline" to post manually.
          </span>
        </div>
      )}

      {/* Save button */}
      <div className="schedule-row schedule-row--end">
        <button
          className="save-btn"
          onClick={handleSave}
          disabled={updateSchedule.isPending}
        >
          {updateSchedule.isPending ? "SAVING..." : "SAVE SCHEDULE"}
        </button>
      </div>
    </div>
  );
}
