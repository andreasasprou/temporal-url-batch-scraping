import type { WorkflowHandle } from '@temporalio/client'
import type { ExternalWorkflowHandle } from '@temporalio/workflow/lib/workflow-handle'
import { defineSignal } from '@temporalio/workflow'

const VERSION = 'v0.12'

export const DEFAULT_TASK_QUEUE = `url-scraper-${VERSION}`

export const BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID = `batch-id-assigner-workflow-${VERSION}`

// Time unit accepted by https://www.npmjs.com/package/ms
export const SCRAPE_INTERVAL = '10s'
export const MAX_BATCH_SIZE = 2

export const getBatchProcessorWorkflowId = (batchId: number) => `batch-processors-${VERSION}:${batchId}`

// TODO: Apply transformation on url to normalise it etc
export const getScrapedUrlStateWorkflowId = (url: string) => `scraped-url-state-${VERSION}:${url}`

const pingWorkflowSignal = defineSignal('internal_pingWorkflowSignal')

type ErrorWithCode = Error & {
  code?: 5
}

export async function isWorkflowRunning(handle: WorkflowHandle): Promise<boolean> {
  try {
    await handle.signal(pingWorkflowSignal)
  } catch (error) {
    // does code === 5 => NOT_FOUND, already completed, failed etc?
    const isWorkflowNotRunningError = (error as ErrorWithCode).code === 5

    if (isWorkflowNotRunningError) {
      return false
    }

    // Unexpected error
    throw error
  }

  return true
}

type ExternalWorkflowHandleError = Error & {
  type: 'ExternalWorkflowExecutionNotFound'
}

export async function isExternalWorkflowRunning(handle: Pick<ExternalWorkflowHandle, 'signal'>): Promise<boolean> {
  try {
    await handle.signal(pingWorkflowSignal)
  } catch (error) {
    const isWorkflowNotRunningError =
      (error as ExternalWorkflowHandleError).type === 'ExternalWorkflowExecutionNotFound'

    if (isWorkflowNotRunningError) {
      return false
    }

    // Unexpected error
    throw error
  }

  return true
}
