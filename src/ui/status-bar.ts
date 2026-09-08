import * as vscode from 'vscode'
import { RateLimits, AuthData, UsageDisplayMode } from '../types'
import {
  createMainTooltip,
  createAuthRequiredTooltip,
  createAuthErrorTooltip,
  createUpdatingTooltip,
  createFetchErrorTooltip,
  createUpdateErrorTooltip,
} from './tooltip-builder'
import {
  WARNING_THRESHOLD,
  CRITICAL_THRESHOLD,
} from './progress-bar'

const STATUS_COLORS = {
  light: {
    green: '#1a7f37',
    yellow: '#9a6700',
    red: '#cf222e',
  },
  dark: {
    green: '#7ee787',
    yellow: '#e3b341',
    red: '#ff7b72',
  },
} as const

let statusBarItem: vscode.StatusBarItem
let currentRateLimits: RateLimits | undefined
let currentAuthData: AuthData | undefined
let currentUsageUpdatedAt: Date | undefined
let currentStatus: 'initializing' | 'success' | 'updating' | 'error' | 'auth' =
  'initializing'

/**
 * Create and initialize the status bar item
 */
export function createStatusBarItem(): vscode.StatusBarItem {
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  )

  // Set initial state with better styling
  statusBarItem.text = '$(codex-blossom) $(sync~spin)'
  statusBarItem.tooltip = 'Initializing Codex Stats Monitor...'
  statusBarItem.command = 'codex-usage.noop' // Just for pointer cursor
  statusBarItem.show()

  return statusBarItem
}

/**
 * Update status bar with rate limits data
 */
export function updateStatusBar(rateLimits: RateLimits, authData: AuthData) {
  currentRateLimits = rateLimits
  currentAuthData = authData
  currentUsageUpdatedAt = new Date()
  currentStatus = 'success'

  renderCurrentUsage()
}

function renderCurrentUsage() {
  if (!currentRateLimits || !currentAuthData || !currentUsageUpdatedAt) {
    return
  }

  const config = vscode.workspace.getConfiguration('codexUsage')
  const displayMode = config.get<UsageDisplayMode>('displayMode', 'used')

  // Determine usage percentages
  const primaryPercent = currentRateLimits.primary?.used_percent
  const secondaryPercent = currentRateLimits.secondary?.used_percent

  // Show the most constrained window in the status bar. In used mode this is
  // the highest usage; in remaining mode it is the lowest remaining value.
  const availableUsedPercents: number[] = []
  if (primaryPercent !== undefined) availableUsedPercents.push(primaryPercent)
  if (secondaryPercent !== undefined)
    availableUsedPercents.push(secondaryPercent)

  if (availableUsedPercents.length === 0) {
    statusBarItem.text = '$(codex-blossom) —'
    statusBarItem.color = undefined
    statusBarItem.backgroundColor = undefined
    statusBarItem.tooltip = createMainTooltip(
      currentRateLimits,
      currentAuthData,
      primaryPercent,
      secondaryPercent,
      displayMode,
      currentUsageUpdatedAt,
    )
    return
  }

  const mostConstrainedUsedPercent = Math.max(...availableUsedPercents)
  const secondaryIsMostConstrained =
    secondaryPercent !== undefined &&
    (primaryPercent === undefined || secondaryPercent > primaryPercent)
  const displayedWindow = secondaryIsMostConstrained
    ? currentRateLimits.secondary
    : currentRateLimits.primary
  const displayedLimit = formatWindowLabel(
    displayedWindow?.window_minutes,
    secondaryIsMostConstrained ? '7d' : '5h',
  )
  const statusColor = getStatusColor(mostConstrainedUsedPercent)

  const mostConstrainedDisplayPercent = getDisplayPercent(
    mostConstrainedUsedPercent,
    displayMode,
  )

  // Update status bar text with usage-mapped color
  statusBarItem.text = `$(codex-blossom) ${mostConstrainedDisplayPercent.toFixed(0)}% (${displayedLimit})`
  statusBarItem.color = statusColor
  statusBarItem.backgroundColor = undefined

  // Set tooltip
  statusBarItem.tooltip = createMainTooltip(
    currentRateLimits,
    currentAuthData,
    primaryPercent,
    secondaryPercent,
    displayMode,
    currentUsageUpdatedAt,
  )
}

function getStatusColor(usedPercent: number): string {
  const themeKind = vscode.window.activeColorTheme.kind
  const colors =
    themeKind === vscode.ColorThemeKind.Light ||
    themeKind === vscode.ColorThemeKind.HighContrastLight
      ? STATUS_COLORS.light
      : STATUS_COLORS.dark

  if (usedPercent >= CRITICAL_THRESHOLD) return colors.red
  if (usedPercent >= WARNING_THRESHOLD) return colors.yellow
  return colors.green
}

/**
 * Re-render the current usage data after a display setting changes
 */
export function refreshStatusBarDisplay() {
  if (currentStatus === 'success') {
    renderCurrentUsage()
  }
}

function getDisplayPercent(
  usedPercent: number,
  displayMode: UsageDisplayMode,
): number {
  return displayMode === 'remaining' ? 100 - usedPercent : usedPercent
}

function formatWindowLabel(windowMinutes: number | undefined, fallback: string) {
  if (windowMinutes === undefined || windowMinutes <= 0) return fallback

  const minutesPerDay = 24 * 60
  if (windowMinutes >= minutesPerDay) {
    return `${Math.round(windowMinutes / minutesPerDay)}d`
  }

  return `${Math.max(1, Math.round(windowMinutes / 60))}h`
}

/**
 * Show authentication required state
 */
export function showAuthRequired() {
  currentStatus = 'auth'
  statusBarItem.text = '$(error)'
  statusBarItem.color = new vscode.ThemeColor('errorForeground')
  statusBarItem.tooltip = createAuthRequiredTooltip()
  statusBarItem.command = 'codex-usage.noop' // Just for pointer cursor
}

/**
 * Show authentication error state
 */
export function showAuthError(error: any) {
  currentStatus = 'auth'
  statusBarItem.text = '$(error)'
  statusBarItem.color = new vscode.ThemeColor('errorForeground')
  statusBarItem.tooltip = createAuthErrorTooltip(error)
}

/**
 * Show updating state
 */
export function showUpdating() {
  currentStatus = 'updating'
  statusBarItem.text = '$(codex-blossom) $(sync~spin)'
  statusBarItem.color = undefined // Reset color while updating
  statusBarItem.tooltip = createUpdatingTooltip()
}

/**
 * Show fetch error state
 */
export function showFetchError() {
  currentStatus = 'error'
  statusBarItem.text = '$(warning)'
  statusBarItem.color = new vscode.ThemeColor('editorWarning.foreground')
  statusBarItem.tooltip = createFetchErrorTooltip()
}

/**
 * Show update error state
 */
export function showUpdateError(error: any) {
  currentStatus = 'error'
  statusBarItem.text = '$(warning)'
  statusBarItem.color = new vscode.ThemeColor('editorWarning.foreground')
  statusBarItem.tooltip = createUpdateErrorTooltip(error)
}

/**
 * Get the status bar item
 */
export function getStatusBarItem(): vscode.StatusBarItem {
  return statusBarItem
}
