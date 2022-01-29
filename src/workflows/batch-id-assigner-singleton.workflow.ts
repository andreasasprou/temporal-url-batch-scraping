import {
  DEFAULT_TASK_QUEUE,
  getBatchProcessorWorkflowId,
  getScrapedUrlStateWorkflowId,
  isExternalWorkflowRunning
} from '../shared'
import {
  batchIdAssignedSignal,
  BatchIdAssignedSignalPayload,
  assignToBatchSignal,
  startScrapingUrlSignal
} from '../signals'
import { continueAsNew, getExternalWorkflowHandle, setHandler, sleep, startChild } from '@temporalio/workflow'
import { scrapeUrlBatchWorkflow } from './scrape-url-batch.workflow'
import ms from 'ms'
import { ExternalWorkflowHandle } from '@temporalio/workflow/lib/workflow-handle'

// We want this as large as possible. TODO: document tradeoffs & heuristics to estimate it's max
const MAX_BATCH_SIZE = 200

interface Payload {
  initialState?: {
    numberOfUrlsInCurrentBatch: number
    currentBatchId: number | undefined
  }
}

export async function batchIdAssignerSingletonWorkflow({ initialState }: Payload) {
  let numberOfSignalsHandled = 0
  let numberOfUrlsInCurrentBatch = initialState?.numberOfUrlsInCurrentBatch ?? 0
  let currentBatchId: number | undefined = initialState?.currentBatchId

  const generateNextBatchId = () => {
    if (!currentBatchId) {
      return 0
    }

    return currentBatchId + 1
  }

  const createNextBatch = () => {
    currentBatchId = generateNextBatchId()
    numberOfUrlsInCurrentBatch = 0
  }

  const getNextBatchIdForUrl = async (url: string) => {
    if (currentBatchId === undefined || numberOfUrlsInCurrentBatch >= MAX_BATCH_SIZE) {
      createNextBatch()
    }

    const nextBatchId = currentBatchId!

    const findOrStartBatchProcessorWorkflow = async () => {
      const workflowId = getBatchProcessorWorkflowId(nextBatchId)

      let batchProcessorHandle: Pick<ExternalWorkflowHandle, 'signal'> = getExternalWorkflowHandle(workflowId)

      // TODO: Think about race conditions

      // TODO: LOCK

      // Replace with signalWithStart once implemented https://github.com/temporalio/temporal/issues/537
      if (!(await isExternalWorkflowRunning(batchProcessorHandle))) {
        console.log('creating new batch workflow to start scraping url', url)

        batchProcessorHandle = await startChild(scrapeUrlBatchWorkflow, {
          workflowId: getBatchProcessorWorkflowId(nextBatchId),
          taskQueue: DEFAULT_TASK_QUEUE,
          args: [
            {
              batchId: nextBatchId
            }
          ]
        })
      } else {
        console.log('re-using batch workflow to start scraping url', url)
      }

      // TODO: UNLOCK

      return batchProcessorHandle
    }

    console.log('signaling to batch handler to start scraping url', url)

    const handler = await findOrStartBatchProcessorWorkflow()

    await handler.signal(startScrapingUrlSignal, {
      url
    })

    numberOfUrlsInCurrentBatch += 1

    return {
      nextBatchId
    }
  }

  const notifyStateWorkflowWithItsNewBatchId = async ({ url, batchId }: BatchIdAssignedSignalPayload) => {
    const handle = getExternalWorkflowHandle(getScrapedUrlStateWorkflowId(url))

    if (!(await isExternalWorkflowRunning(handle))) {
      console.log(`⚠️ failed to notify state workflow as it doesnt exist`)

      return
    }

    await handle.signal(batchIdAssignedSignal, {
      batchId,
      url
    })
  }

  setHandler(assignToBatchSignal, async ({ url }) => {
    console.log('requested new batch ID', url)

    const { nextBatchId } = await getNextBatchIdForUrl(url)

    console.log('next batch id', { url, nextBatchId })

    // Let the scraped url state workflow know that it's been assigned to a batch
    await notifyStateWorkflowWithItsNewBatchId({
      url,
      batchId: nextBatchId
    })

    console.log('notified state workflow with new batch id', { url, nextBatchId })

    numberOfSignalsHandled += 1

    const shouldContinueAsNew = numberOfSignalsHandled === 1000

    if (shouldContinueAsNew) {
      await continueAsNew<typeof batchIdAssignerSingletonWorkflow>({
        initialState: {
          currentBatchId,
          numberOfUrlsInCurrentBatch
        }
      })
    }
  })

  // Run forever (is there a better way of doing this in Temporal?)
  while (true) {
    await sleep(ms('100000days'))
  }
}
