/** RFC-style CSV field escaping (commas, quotes, newlines). */
export function escapeCsvField(value: unknown): string {
  if (value == null) return ''
  const str = typeof value === 'string' ? value : String(value)
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function csvRow(fields: unknown[]): string {
  return fields.map(escapeCsvField).join(',')
}

/** Join rows with CRLF for spreadsheet compatibility. */
export function buildCsv(rows: unknown[][]): string {
  return `${rows.map(csvRow).join('\r\n')}\r\n`
}

/** Safe download filename segment (no path chars). */
export function sanitizeFilenamePart(value: string, fallback = 'pool'): string {
  const cleaned = value
    .trim()
    .replace(/[^\w\s-]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return cleaned || fallback
}
