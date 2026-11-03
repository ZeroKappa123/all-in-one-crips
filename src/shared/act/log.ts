/**
 * Client.txt is the game's own log. We only read it. Relevant lines (PoE 1):
 *
 *   2026/11/03 12:00:01 1234 abcd [DEBUG Client 99] Generating level 2 area "1_1_2" with seed 7
 *   2026/11/03 12:00:02 1234 abcd [INFO Client 99] : You have entered The Coast.
 *   2026/11/03 12:05:00 1234 abcd [INFO Client 99] : Marc_Witch (Witch) is now level 5
 *   2026/11/03 12:06:00 1234 abcd [INFO Client 99] @From <GLD> Seller: hi
 *   2026/11/03 12:06:01 1234 abcd [INFO Client 99] @To Seller: thanks
 *   2026/11/03 12:07:00 1234 abcd [INFO Client 99] : AFK mode is now ON. Autoreply "..."
 */
export type LogEvent =
  | { kind: 'area'; id: string; level: number; at: number }
  | { kind: 'entered'; name: string; at: number }
  | { kind: 'levelUp'; character: string; className: string; level: number; at: number }
  | { kind: 'whisper'; direction: 'from' | 'to'; name: string; at: number }
  | { kind: 'afk'; on: boolean; at: number }

const STAMP = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2})/
const GENERATING = /Generating level (\d+) area "([^"]+)"/
const ENTERED = /\] : You have entered (.+)\.$/
const LEVEL = /\] : (\S+) \(([A-Za-z]+)\) is now level (\d+)$/
const WHISPER = /\] @(From|To) (?:<[^>]*> )?([^:]+):/
const AFK = /\] : AFK mode is now (ON|OFF)/

export function parseLogLine(line: string): LogEvent | null {
  const s = STAMP.exec(line)
  if (!s) return null
  const at = new Date(+s[1]!, +s[2]! - 1, +s[3]!, +s[4]!, +s[5]!, +s[6]!).getTime()
  let m: RegExpExecArray | null
  if ((m = GENERATING.exec(line))) return { kind: 'area', id: m[2]!, level: +m[1]!, at }
  if ((m = ENTERED.exec(line))) return { kind: 'entered', name: m[1]!, at }
  if ((m = LEVEL.exec(line))) return { kind: 'levelUp', character: m[1]!, className: m[2]!, level: +m[3]!, at }
  if ((m = WHISPER.exec(line))) return { kind: 'whisper', direction: m[1] === 'From' ? 'from' : 'to', name: m[2]!.trim(), at }
  if ((m = AFK.exec(line))) return { kind: 'afk', on: m[1] === 'ON', at }
  return null
}

/** Splits a chunk into complete lines, carrying a partial last line over to the next chunk. */
export class LineBuffer {
  private rest = ''
  push(chunk: string): string[] {
    const text = this.rest + chunk
    const lines = text.split(/\r?\n/)
    this.rest = lines.pop() ?? ''
    return lines
  }
}

/** The current state as far as the tail of the log tells us. */
export interface LogSnapshot {
  areaId: string | null
  areaLevel: number | null
  levels: Record<string, number> // character -> level
  lastWhisper: string | null
}

export function snapshot(lines: string[]): LogSnapshot {
  const s: LogSnapshot = { areaId: null, areaLevel: null, levels: {}, lastWhisper: null }
  for (const l of lines) applyEvent(s, parseLogLine(l))
  return s
}

export function applyEvent(s: LogSnapshot, e: LogEvent | null): void {
  if (!e) return
  if (e.kind === 'area') { s.areaId = e.id; s.areaLevel = e.level }
  else if (e.kind === 'levelUp') s.levels[e.character] = e.level
  else if (e.kind === 'whisper') s.lastWhisper = e.name
}

export function defaultLogPaths(platform: NodeJS.Platform, home: string): string[] {
  const rel = ['Path of Exile', 'logs', 'Client.txt']
  if (platform === 'win32') {
    return [
      ['C:', 'Program Files (x86)', 'Grinding Gear Games', ...rel].join('\\'),
      ['C:', 'Program Files (x86)', 'Steam', 'steamapps', 'common', ...rel].join('\\'),
      ['C:', 'Program Files', 'Steam', 'steamapps', 'common', ...rel].join('\\'),
      ['C:', 'Program Files', 'Grinding Gear Games', ...rel].join('\\'),
      ['D:', 'SteamLibrary', 'steamapps', 'common', ...rel].join('\\'),
      ['C:', 'Program Files (x86)', 'Epic Games', 'PathOfExile', 'logs', 'Client.txt'].join('\\')
    ]
  }
  if (platform === 'darwin') return [`${home}/Library/Caches/com.GGG.PathOfExile/Logs/Client.txt`]
  return [
    `${home}/.local/share/Steam/steamapps/common/Path of Exile/logs/Client.txt`,
    `${home}/.steam/steam/steamapps/common/Path of Exile/logs/Client.txt`
  ]
}
