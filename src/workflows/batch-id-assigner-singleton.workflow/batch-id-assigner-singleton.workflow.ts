import { MAX_BATCH_SIZE, CONTINUE_AS_NEW_THRESHOLD } from '../../shared'
import { assignToBatchSignal, newGapSignal } from '../../signals'
import {
  continueAsNew,
  setHandler,
  proxyActivities,
  condition,
  sleep
} from '@temporalio/workflow'
import { useBatchIsGapsState } from './batch-id-gaps.state'
import { getBatchIdGapsQuery } from '../../queries'
import type * as activities from '../../activities'

const MAX_ITERATIONS = 1000

const { ensureBatchProcessorWorkflowForURL: ensureBatchProcessorWorkflowForURLActivity } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: '1 minute'
})

interface Payload {
  initialState?: {
    numberOfUrlsInCurrentBatch: number
    currentBatchId: number | undefined
  }
}

type BatchSlice = {
  batchId: number,
  count: number
}

export async function batchIdAssignerSingletonWorkflow({ initialState }: Payload = {}) {
  const { incNumberOfGaps, pullFirstBatchIdWithGap, batchIdToNumberOfGaps } = useBatchIsGapsState()

  setHandler(getBatchIdGapsQuery, () => batchIdToNumberOfGaps)

  let numberOfUrlsInCurrentBatch = initialState?.numberOfUrlsInCurrentBatch ?? 0
  let currentBatchId: number = initialState?.currentBatchId ?? 0

  const cycleToNewBatch = () => {
    currentBatchId += 1
    numberOfUrlsInCurrentBatch = 0
  }

  const getBatchNextBatchSlice = (requestedCount: number): BatchSlice => {
    const batchIdWithGap = pullFirstBatchIdWithGap()

    if (batchIdWithGap) {
      const block = { batchId: batchIdWithGap!, count: 1 }
      console.log('found gap batch slice', block)
      
      return { batchId: batchIdWithGap, count: 1 }
    }

    if (currentBatchId === undefined || numberOfUrlsInCurrentBatch >= MAX_BATCH_SIZE) {
      cycleToNewBatch()
    }

    if (requestedCount > MAX_BATCH_SIZE) {
      requestedCount = MAX_BATCH_SIZE
    }
    let availableCount = MAX_BATCH_SIZE - numberOfUrlsInCurrentBatch
    let count = requestedCount <= availableCount ? requestedCount : availableCount
    
    numberOfUrlsInCurrentBatch += count

    const slice = { batchId: currentBatchId!, count }
    console.log('found batch slice', { requested: requestedCount, available: availableCount, assigned: slice })

    return slice
  }

  let urlsToAssign: string[] = []

  setHandler(assignToBatchSignal, async ({ url }) => {
    urlsToAssign.push(url)
  })

  setHandler(newGapSignal, ({ batchId }) => incNumberOfGaps(batchId))

  let ContinueAsNewTimerFired = false
  sleep(CONTINUE_AS_NEW_THRESHOLD).then(() => ContinueAsNewTimerFired = true )

  // Loop for MAX_ITERATIONS or until our CONTINUE_AS_NEW_THRESHOLD timer fires, whichever is shorter.
  // We continue-as-new at least every day to aid in the cleanup of old code versions.
  for (let iteration = 1; iteration <= MAX_ITERATIONS && !ContinueAsNewTimerFired; ++iteration) {
    // Wait up to 10 seconds to let a batch build up
    await condition(() => urlsToAssign.length >= MAX_BATCH_SIZE, '10s')

    while (urlsToAssign.length) {
      const slice = getBatchNextBatchSlice(urlsToAssign.length)
      const urls = urlsToAssign.splice(0, slice.count)
      const batchId = slice.batchId
  
      console.log('assignment', { urls, batchId, urlsLeft: urlsToAssign.length })
  
      await ensureBatchProcessorWorkflowForURLActivity({ urls, batchId })
    }
  }

  await continueAsNew<typeof batchIdAssignerSingletonWorkflow>({
    initialState: {
      currentBatchId,
      numberOfUrlsInCurrentBatch
    }
  })
}
