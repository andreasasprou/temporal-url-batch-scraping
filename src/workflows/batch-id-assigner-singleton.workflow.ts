import { DEFAULT_TASK_QUEUE, getBatchProcessorWorkflowId, temporalClient } from '../shared'
import { startScrapingUrlSignal, ScrapeNewUrlSignalPayload } from '../signals'
import { setHandler } from '@temporalio/workflow'
import { getNextBatchIdSignal } from '../queries'
import { scrapeUrlBatchWorkflow } from './scrape-url-batch.workflow'

// We want this as large as possible. TODO: document tradeoffs & heuristics to estimate it's max
const MAX_BATCH_SIZE = 200

export async function batchIdAssignerSingletonWorkflow() {
  let numberOfUrlsInCurrentBatch = 0
  let currentBatchId: number | undefined = undefined

  const generateNextBatchId = () => {
    if (!currentBatchId) {
      return 0
    }

    return currentBatchId + 1
  }

  const createNextBatch = () => {
    console.debug('Generating next batch ID', {
      numberOfUrlsInCurrentBatch,
      currentBatchId
    })

    currentBatchId = generateNextBatchId()
    numberOfUrlsInCurrentBatch = 0

    console.debug('Generated next batch ID', {
      numberOfUrlsInCurrentBatch,
      currentBatchId
    })
  }

  const getNextBatchIdForUrl = async (url: string) => {
    if (currentBatchId === undefined || numberOfUrlsInCurrentBatch >= MAX_BATCH_SIZE) {
      createNextBatch()
    }

    const nextBatchId = currentBatchId!

    console.debug('Signaling to start scraping url', url)

    // If you're not sure if a Workflow is running, you can signalWithStart a Workflow to send it a Signal
    // and optionally start the Workflow if it is not running.
    await temporalClient.signalWithStart<typeof scrapeUrlBatchWorkflow, [ScrapeNewUrlSignalPayload]>(
      scrapeUrlBatchWorkflow,
      {
        workflowId: getBatchProcessorWorkflowId(nextBatchId),
        taskQueue: DEFAULT_TASK_QUEUE,
        args: [
          {
            batchId: nextBatchId
          }
        ],
        signal: startScrapingUrlSignal,
        signalArgs: [
          {
            url
          }
        ]
      }
    )

    numberOfUrlsInCurrentBatch += 1

    return {
      nextBatchId
    }
  }

  setHandler(getNextBatchIdSignal, async ({ url }) => getNextBatchIdForUrl(url))

  // Run forever (should we use sleep(Infinity) instead?)
  // eslint-disable-next-line no-empty
  while (true) {}
}
