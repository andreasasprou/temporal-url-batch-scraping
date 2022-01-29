import { WorkflowHandle } from '@temporalio/client'
import { ExternalWorkflowHandle } from '@temporalio/workflow/lib/workflow-handle'
import { defineSignal } from '@temporalio/workflow'

export const DEFAULT_TASK_QUEUE = 'url-scraper-v1'

export const BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID = 'batch-id-assigner-workflow-v2'

// Time unit accepted by https://www.npmjs.com/package/ms
export const SCRAPE_FREQUENCY = '10s'

export const getBatchProcessorWorkflowId = (batchId: number) => `batch-processors:${batchId}`

// TODO: Apply transformation on url to normalise it etc
export const getScrapedUrlStateWorkflowId = (url: string) => `scraped-url-state-v9:${url}`

type ErrorWithCode = Error & {
  code?: 5
}

export async function isWorkflowRunning(handle: WorkflowHandle): Promise<boolean> {
  try {
    await handle.describe()
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

const pingWorkflowSignal = defineSignal('internal_pingWorkflowSignal')

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
