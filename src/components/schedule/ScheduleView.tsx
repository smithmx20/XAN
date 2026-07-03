"use client";

// components/schedule/ScheduleView.tsx
import { useState } from "react";
import { CalendarDays, Clock } from "lucide-react";
import type { AiringSchedule } from "@/types/anime";
import { ScheduleCard } from "./ScheduleCard";

interface ScheduleViewProps {
  byDay: Record<number, AiringSchedule[]>;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export function ScheduleView({ byDay }: ScheduleViewProps) {
  const today = new Date().getDay(); // local day — matches byDay bucketing
  const [activeDay, setActiveDay] = useState<number>(today);

  const entries = byDay[activeDay] ?? [];
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
        {dayOrder.map((dayIdx) => {
          const isToday = dayIdx === today;
          const isActive = dayIdx === activeDay;
          const count = (byDay[dayIdx] ?? []).length;
          return (
            <button
              key={dayIdx}
              onClick={() => setActiveDay(dayIdx)}
              className={`relative px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all border ${
                isActive
                  ? "bg-gradient-to-r from-xan-crimson to-xan-violet text-white border-transparent shadow-[0_0_20px_rgba(233,69,96,0.3)]"
                  : "bg-xan-card text-muted-foreground hover:text-foreground hover:bg-xan-card-hover border-xan-border"
              }`}
            >
              <div className="flex items-center gap-2">
                <span>{DAY_LABELS[dayIdx]}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isActive ? "bg-white/20 text-white" : "bg-white/5 text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                )}
                {isToday && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-xan-crimson/20 text-xan-crimson border border-xan-crimson/40"
                    }`}
                  >
                    TODAY
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-baseline justify-between">
        <h2 className="text-xl md:text-2xl font-bold font-display text-foreground flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-xan-crimson" />
          {DAY_FULL[activeDay]}
          {activeDay === today && (
            <span className="text-xs font-normal text-muted-foreground ml-2">
              (today)
            </span>
          )}
        </h2>
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {entries.length} airing{entries.length !== 1 ? "s" : ""}
        </span>
      </div>

      {entries.length > 0 ? (
        <div className="space-y-2">
          {entries.map((s) => (
            <ScheduleCard key={`${s.id}-${s.episode}`} schedule={s} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-xan-border bg-xan-card/50 py-16 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">No airings scheduled</p>
          <p className="text-sm text-muted-foreground mt-1">
            Nothing airing on {DAY_FULL[activeDay]} this week.
          </p>
        </div>
      )}
    </div>
  );
}
