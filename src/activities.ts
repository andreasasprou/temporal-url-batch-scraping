import { temporalClient } from './temporal-client'
import { scrapeUrlBatchWorkflow } from './workflows'
import { addItemsToBatchSignal } from './signals'
import { DEFAULT_TASK_QUEUE, getBatchProcessorWorkflowId } from './shared'

interface EnsureBatchProcessorWorkflowForItemsPayload {
  batchId: number
  items: string[]
}

export async function ensureBatchProcessorWorkflowForItems({ batchId, items }: EnsureBatchProcessorWorkflowForItemsPayload) {
  await temporalClient.signalWithStart(
    scrapeUrlBatchWorkflow,
    {
      workflowId: getBatchProcessorWorkflowId(batchId),
      args: [{ batchId }],
      taskQueue: DEFAULT_TASK_QUEUE,
      signal: addItemsToBatchSignal,
      signalArgs: [{ items }],
    }
  )
}

interface ScrapeUrlPayload {
  urls: string[]
}

async function tryScrape(url: string) {
  console.log('scraping url', url)
}

export async function scrapeUrls({ urls }: ScrapeUrlPayload) {
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
