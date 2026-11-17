import * as vscode from 'vscode'
import { loadAuthData } from '../auth/auth-manager'
import { CodexAPIClient } from '../codex-client'
import { AuthData, RateLimits } from '../types'
import {
  updateStatusBar,
  showUpdating,
  showFetchError,
  showUpdateError,
} from '../ui/status-bar'
import { logger } from '../utils/logger'

let apiClient: CodexAPIClient | undefined
let currentAuthData: AuthData | undefined

/**
 * Initialize the usage monitor with authentication data
 */
export function initializeMonitor(authData: AuthData) {
  currentAuthData = authData
  apiClient = new CodexAPIClient(authData, getProxyUrl())
  logger.info('Usage monitor initialized')
}

/**
 * Update usage statistics
 */
export async function updateUsage(reloadAuth = false) {
  if (!apiClient || !currentAuthData) {
    logger.warn('Usage update skipped because the monitor is not initialized')
    return
  }

  try {
    showUpdating()

    if (reloadAuth) {
      await reloadAuthentication()
    }

    apiClient.setProxyUrl(getProxyUrl())

    let rateLimits = await apiClient.getRateLimits()

    if (!rateLimits && !reloadAuth) {
      const previousAccessToken = currentAuthData.accessToken
      await reloadAuthentication()

      if (currentAuthData.accessToken !== previousAccessToken) {
        rateLimits = await apiClient.getRateLimits()
      }
    }

    if (rateLimits) {
      updateStatusBar(rateLimits, currentAuthData)

      const config = vscode.workspace.getConfiguration('codexUsage')
      const showNotifications = config.get<boolean>('showNotifications')

      if (showNotifications) {
        checkRateLimitWarnings(rateLimits)
      }
    } else {
      logger.warn('No rate limits were returned')
      showFetchError()
    }
  } catch (error) {
    logger.error('Unexpected error while updating usage', {
      error: error instanceof Error ? error.message : String(error),
    })
    showUpdateError(error)
  }
}

/**
 * Reload Codex credentials from disk and replace the API client when available.
 */
async function reloadAuthentication(): Promise<void> {
  const latestAuthData = await loadAuthData()
  if (!latestAuthData) {
    return
  }

  currentAuthData = latestAuthData
  apiClient = new CodexAPIClient(latestAuthData, getProxyUrl())
}

/**
 * Check rate limits and show warnings if needed
 */
function checkRateLimitWarnings(rateLimits: RateLimits) {
  const warnings: string[] = []

  if (rateLimits.primary && rateLimits.primary.used_percent > 90) {
    warnings.push(
      `5h limit is ${rateLimits.primary.used_percent.toFixed(1)}% used`,
    )
  }

  if (rateLimits.secondary && rateLimits.secondary.used_percent > 90) {
    warnings.push(
      `Weekly limit is ${rateLimits.secondary.used_percent.toFixed(1)}% used`,
    )
  }

  if (warnings.length > 0) {
    vscode.window.showWarningMessage(
      `Codex Stats Warning: ${warnings.join(', ')}`,
    )
  }
}

/**
 * Get current auth data
 */
export function getCurrentAuthData(): AuthData | undefined {
  return currentAuthData
}

function getProxyUrl(): string | undefined {
  const config = vscode.workspace.getConfiguration('codexUsage')
  const proxyUrl = config.get<string>('proxyUrl')?.trim()
  return proxyUrl || undefined
}
