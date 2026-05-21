import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  startOfWeek,
  endOfWeek,
} from "date-fns";

interface AttendanceRecord {
  date: string;
  status: "present" | "absent" | "late" | "half_day";
  checkIn?: string;
  checkOut?: string;
}

interface AttendanceCalendarProps {
  records: AttendanceRecord[];
  onDateClick?: (date: Date) => void;
  selectedDate?: Date;
  className?: string;
}

export function AttendanceCalendar({
  records,
  onDateClick,
  selectedDate,
  className,
}: AttendanceCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const recordMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    records.forEach((r) => map.set(r.date, r));
    return map;
  }, [records]);

  const getRecordForDate = (date: Date): AttendanceRecord | undefined => {
    const dateStr = format(date, "yyyy-MM-dd");
    return recordMap.get(dateStr);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "present":
        return "bg-green-500";
      case "absent":
        return "bg-red-500";
      case "late":
        return "bg-yellow-500";
      case "half_day":
        return "bg-blue-500";
      default:
        return "bg-muted";
    }
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm sm:text-base">{format(currentMonth, "MMMM yyyy")}</CardTitle>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9"
            onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9"
            onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-[10px] sm:text-xs font-medium text-muted-foreground py-1 sm:py-2"
            >
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.charAt(0)}</span>
            </div>
          ))}

          {days.map((day) => {
            const record = getRecordForDate(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);

            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => onDateClick?.(day)}
                disabled={!isCurrentMonth}
                className={cn(
                  "aspect-square min-h-[36px] min-w-[36px] p-1 rounded-lg text-xs sm:text-sm transition-all relative flex items-center justify-center",
                  isCurrentMonth ? "hover:bg-muted" : "opacity-30 cursor-not-allowed",
                  isSelected && "ring-2 ring-primary",
                  isTodayDate && "font-bold"
                )}
              >
                <span className={cn(!isCurrentMonth && "text-muted-foreground")}>
                  {format(day, "d")}
                </span>
                {record && (
                  <div
                    className={cn(
                      "absolute bottom-0.5 left-1/2 -translate-x-1/2 w-2 h-2 sm:w-1.5 sm:h-1.5 rounded-full",
                      getStatusColor(record.status)
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-4 border-t text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Present</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span>Absent</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span>Late</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span>Half Day</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
