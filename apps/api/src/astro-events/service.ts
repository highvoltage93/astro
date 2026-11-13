import { fork } from "node:child_process";
import { join } from "node:path";
import type { AstroCalendarInput, calculateAstroCalendar } from "@astroprocessor/astrology-core";

let busy = false;
export class CalendarBusyError extends Error {}
export function runAstroCalendar(input: AstroCalendarInput, signal: AbortSignal): Promise<ReturnType<typeof calculateAstroCalendar>> {
  if (busy) return Promise.reject(new CalendarBusyError("Астроподії зараз розраховуються. Спробуйте за кілька секунд."));
  if (signal.aborted) return Promise.reject(new Error("Запит скасовано."));
  busy = true;
  // A process, not a thread: the native Swiss Ephemeris global settings stay isolated.
  return new Promise<ReturnType<typeof calculateAstroCalendar>>((resolve, reject) => {
    const development = __filename.endsWith(".ts");
    const child = fork(join(__dirname, development ? "worker.ts" : "worker.js"), [], {
      execArgv: ["--max-old-space-size=256", ...(development ? ["--require", "tsx/cjs"] : [])],
      stdio: ["ignore", "ignore", "inherit", "ipc"]
    });
    let settled = false;
    const finish = (error?: Error, result?: ReturnType<typeof calculateAstroCalendar>) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer); signal.removeEventListener("abort", abort);
      child.kill("SIGKILL");
      if (error) reject(error); else if (result) resolve(result); else reject(new Error("Порожня відповідь розрахунку."));
    };
    const abort = () => finish(new Error("Запит скасовано."));
    const timer = setTimeout(() => finish(new Error("Розрахунок перевищив 30 секунд. Скоротіть період або оберіть одну планету.")), 30000);
    signal.addEventListener("abort", abort, { once: true });
    child.once("error", (error) => finish(error));
    child.once("exit", () => finish(new Error("Процес розрахунку завершився без результату.")));
    child.once("message", (message: { result?: ReturnType<typeof calculateAstroCalendar>; error?: string }) => finish(message.error ? new Error(message.error) : undefined, message.result));
    child.send(input, (error) => { if (error) finish(error); });
  }).finally(() => { busy = false; });
}
