const VERSION = 'v0.8'

export const DEFAULT_TASK_QUEUE = `url-scraper-${VERSION}`

export const BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID = `batch-id-assigner-workflow-${VERSION}`

// Time unit accepted by https://www.npmjs.com/package/ms
export const SCRAPE_INTERVAL = '10s'
export const MAX_BATCH_SIZE = 100
export const CONTINUE_AS_NEW_THRESHOLD = '1 day'

export const getBatchProcessorWorkflowId = (batchId: number) => `batch-processors-${VERSION}:${batchId}`

// TODO: Apply transformation on url to normalise it etc
export const getScrapedUrlStateWorkflowId = (url: string) => `scraped-url-state-${VERSION}:${url}`

export type TemporalGRPCError = Error & {
  code: number
}
