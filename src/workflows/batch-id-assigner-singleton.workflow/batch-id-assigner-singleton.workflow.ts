import { getScrapedUrlStateWorkflowId, isExternalWorkflowRunning, MAX_BATCH_SIZE } from '../../shared'
import { assignToBatchSignal, batchIdAssignedSignal, BatchIdAssignedSignalPayload, newGapSignal } from '../../signals'
import {
  continueAsNew,
  getExternalWorkflowHandle,
  setHandler,
  sleep,
  proxyActivities,
  condition
} from '@temporalio/workflow'
import ms from 'ms'
import { useBatchIsGapsState } from './batch-id-gaps.state'
import { getBatchIdGapsQuery } from '../../queries'
import type * as activities from '../../activities'

const { ensureBatchProcessorWorkflowForURL: ensureBatchProcessorWorkflowForURLActivity } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: '1 minute'
})

// We want this as large as possible. TODO: document tradeoffs & heuristics to estimate it's max

interface Payload {
  initialState?: {
    numberOfUrlsInCurrentBatch: number
    currentBatchId: number | undefined
  }
}

export async function batchIdAssignerSingletonWorkflow({ initialState }: Payload = {}) {
  const { incNumberOfGaps, pullFirstBatchIdWithGap, batchIdToNumberOfGaps } = useBatchIsGapsState()

  setHandler(getBatchIdGapsQuery, () => batchIdToNumberOfGaps)

  let numberOfUrlsHandled = 0
  let numberOfUrlsInCurrentBatch = initialState?.numberOfUrlsInCurrentBatch ?? 0
  let currentBatchId: number = initialState?.currentBatchId ?? 0

  const cycleToNewBatch = () => {
    currentBatchId += 1
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

  const assignToBatchSignalHandler = async (url: string) => {
    console.log('requested new batch ID', url)

    const nextBatchId = getNextBatchId()

    console.log('next batch id', { url, nextBatchId })

    await ensureBatchProcessorWorkflowForURLActivity({ url, batchId: nextBatchId })

    await notifyStateWorkflowWithItsNewBatchId({
      url,
      batchId: nextBatchId
    })

    console.log('notified state workflow with new batch id', { url, nextBatchId })
  }

  const urlsToAssign: string[] = []

  setHandler(assignToBatchSignal, async ({ url }) => {
    urlsToAssign.push(url)
  })

  setHandler(newGapSignal, ({ batchId }) => incNumberOfGaps(batchId))

  // Run forever (is there a better way of doing this in Temporal?)
  while (true) {
    while (urlsToAssign.length > 0) {
      const nextUrlToAssign = urlsToAssign.shift()

      if (!nextUrlToAssign) {
        break
      }

      await assignToBatchSignalHandler(nextUrlToAssign)
      numberOfUrlsHandled += 1
    }

    const shouldContinueAsNew = numberOfUrlsHandled === 1000

    if (shouldContinueAsNew) {
      await continueAsNew<typeof batchIdAssignerSingletonWorkflow>({
        initialState: {
          currentBatchId,
          numberOfUrlsInCurrentBatch
        }
      })
    }

    // Run forever (is there a better way of doing this in Temporal?) @Roey
    await condition(() => urlsToAssign.length > 0, ms('100000days'))
  }
}
