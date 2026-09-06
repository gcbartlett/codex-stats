export const WARNING_THRESHOLD = 75
export const CRITICAL_THRESHOLD = 90

/**
 * Create an emoji-based progress bar like cursor-stats
 */
export function createProgressBar(
  percent: number,
  usagePercent: number = percent,
): string {
  // Emoji-based progress bar like cursor-stats
  const PROGRESS_EMPTY = '⬜'
  const PROGRESS_FILLED = '🟩'
  const PROGRESS_WARNING = '🟨'
  const PROGRESS_CRITICAL = '🟥'

  const length = 10 // Number of emoji blocks
  // Ensure percentage is within 0-100 range
  const clampedPercentage = Math.max(0, Math.min(100, percent))

  // Calculate filled positions
  const filledCount = Math.round((clampedPercentage / 100) * length)
  const emptyCount = length - filledCount

  // Choose emoji color based on thresholds
  let filledEmoji = PROGRESS_FILLED
  const clampedUsagePercentage = Math.max(0, Math.min(100, usagePercent))
  if (clampedUsagePercentage >= CRITICAL_THRESHOLD) {
    filledEmoji = PROGRESS_CRITICAL
  } else if (clampedUsagePercentage >= WARNING_THRESHOLD) {
    filledEmoji = PROGRESS_WARNING
  }

  // Build the progress bar
  const bar =
    filledEmoji.repeat(filledCount) + PROGRESS_EMPTY.repeat(emptyCount)

  // Format with percentage aligned
  return `${bar}  **${percent.toFixed(0)}%**`
}
