import { temporalClient } from './temporal-client'
import { scrapeUrlBatchWorkflow } from './workflows'
import { startScrapingUrlSignal } from './signals'
import { DEFAULT_TASK_QUEUE, getBatchProcessorWorkflowId } from './shared'

interface EnsureBatchProcessorWorkflowForURLPayload {
  batchId: number
  urls: string[]
}

interface ScrapeUrlPayload {
  urls: string[]
  batchId: number
}

async function tryScrape(url: string) {
  console.log('scraping url', url)
}

export async function ensureBatchProcessorWorkflowForURL({ batchId, urls }: EnsureBatchProcessorWorkflowForURLPayload) {
  await temporalClient.signalWithStart(
    scrapeUrlBatchWorkflow,
    {
      workflowId: getBatchProcessorWorkflowId(batchId),
      args: [{ batchId }],
      taskQueue: DEFAULT_TASK_QUEUE,
      signal: startScrapingUrlSignal,
      signalArgs: [{ urls }],
    }
  )
}

export async function scrapeUrls({ urls, batchId }: ScrapeUrlPayload) {
  // use something like p-props to limit concurrency
  await Promise.all(
    urls.map(async (url) => {
      try {
        await tryScrape(url)

        // todo: heartbeat success
      } catch (error) {
        console.error(error)
        // TODO: heartbeat error
      }
    })
  )
}
