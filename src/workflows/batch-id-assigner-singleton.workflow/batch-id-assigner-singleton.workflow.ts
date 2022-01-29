import { getScrapedUrlStateWorkflowId, isExternalWorkflowRunning } from '../../shared'
import { assignToBatchSignal, batchIdAssignedSignal, BatchIdAssignedSignalPayload, newGapSignal } from '../../signals'
import { continueAsNew, getExternalWorkflowHandle, setHandler, sleep } from '@temporalio/workflow'
import ms from 'ms'
import { useBatchIsGapsState } from './batch-id-gaps.state'
import { assignUrlToBatchProcessorWorkflow } from './assign-url-to-batch-processor'

// We want this as large as possible. TODO: document tradeoffs & heuristics to estimate it's max
const MAX_BATCH_SIZE = 200

interface Payload {
  initialState?: {
    numberOfUrlsInCurrentBatch: number
    currentBatchId: number | undefined
  }
}

export async function batchIdAssignerSingletonWorkflow({ initialState }: Payload = {}) {
  const { incNumberOfGaps, pullFirstBatchIdWithGap } = useBatchIsGapsState()

  let numberOfSignalsHandled = 0
  let numberOfUrlsInCurrentBatch = initialState?.numberOfUrlsInCurrentBatch ?? 0
  let currentBatchId: number | undefined = initialState?.currentBatchId

  const generateNextBatchId = () => {
    if (!currentBatchId) {
      return 0
    }

    return currentBatchId + 1
  }

  const cycleToNewBatch = () => {
    currentBatchId = generateNextBatchId()
    numberOfUrlsInCurrentBatch = 0
  }

  const getNextBatchId = (): number => {
    const batchIdWithGap = pullFirstBatchIdWithGap()

    if (batchIdWithGap) {
      console.log('found batch with gap, attempting to fill', batchIdWithGap)
      return batchIdWithGap
    }

    if (currentBatchId === undefined || numberOfUrlsInCurrentBatch >= MAX_BATCH_SIZE) {
      cycleToNewBatch()
    }

    numberOfUrlsInCurrentBatch += 1

    return currentBatchId!
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

    const nextBatchId = getNextBatchId()

    await assignUrlToBatchProcessorWorkflow(url, nextBatchId)

    console.log('next batch id', { url, nextBatchId })

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

  setHandler(newGapSignal, ({ batchId }) => incNumberOfGaps(batchId))

  // Run forever (is there a better way of doing this in Temporal?)
  while (true) {
    await sleep(ms('100000days'))
  }
}
