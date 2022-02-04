import { MAX_BATCH_SIZE, CONTINUE_AS_NEW_THRESHOLD } from '../../shared'
import { assignToBatchSignal, removedItemFromBatchSignal } from '../../signals'
import {
  continueAsNew,
  setHandler,
  proxyActivities,
  condition,
  sleep
} from '@temporalio/workflow'
import { useBatchIdGapsState } from './batch-id-gaps.state'
import { getBatchIdGapsQuery } from '../../queries'
import type * as activities from '../../activities'

const MAX_ITERATIONS = 1000

const { ensureBatchProcessorWorkflowForItems: ensureBatchProcessorWorkflowForItems } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: '1 minute'
})

interface Payload {
  initialState?: {
    currentBatchItemCount: number
    currentBatchId: number | undefined
  }
}

type BatchSlice = {
  batchId: number,
  count: number
}

export async function batchIdAssignerSingletonWorkflow({ initialState }: Payload = {}) {
  const { incNumberOfGaps, pullFirstBatchIdWithGap, batchIdToNumberOfGaps } = useBatchIdGapsState()

  setHandler(getBatchIdGapsQuery, () => batchIdToNumberOfGaps)

  let currentBatchId: number = initialState?.currentBatchId ?? 0
  let currentBatchItemCount: number = initialState?.currentBatchItemCount ?? 0

  const cycleToNewBatch = () => {
    currentBatchId += 1
    currentBatchItemCount = 0
  }

  const getBatchNextBatchSlice = (requestedCount: number): BatchSlice => {
    const batchIdWithGap = pullFirstBatchIdWithGap()

    if (batchIdWithGap) {
      const block = { batchId: batchIdWithGap!, count: 1 }
      console.log('found gap batch slice', block)
      
      return { batchId: batchIdWithGap, count: 1 }
    }

    if (currentBatchId === undefined || currentBatchItemCount >= MAX_BATCH_SIZE) {
      cycleToNewBatch()
    }

    if (requestedCount > MAX_BATCH_SIZE) {
      requestedCount = MAX_BATCH_SIZE
    }
    let availableCount = MAX_BATCH_SIZE - currentBatchItemCount
    let count = requestedCount <= availableCount ? requestedCount : availableCount
    
    currentBatchItemCount += count

    const slice = { batchId: currentBatchId!, count }
    
    console.log('found batch slice', { requested: requestedCount, available: availableCount, assigned: slice })

    return slice
  }

  let itemsToAssign: string[] = []

  setHandler(assignToBatchSignal, async ({ item }) => {
    itemsToAssign.push(item)
  })

  setHandler(removedItemFromBatchSignal, ({ batchId }) => incNumberOfGaps(batchId))

  // We continue-as-new at least every day to aid in the cleanup of old code versions.
  let TimeToContinueAsNew = false
  sleep(CONTINUE_AS_NEW_THRESHOLD).then(() => TimeToContinueAsNew = true)

  for (let iteration = 1; iteration <= MAX_ITERATIONS; ++iteration) {
    // Wait till we get at least one item to assign or it's time to continue as new.
    await condition(() => itemsToAssign.length > 0 || TimeToContinueAsNew)
    if (TimeToContinueAsNew) { break }

    // Wait a little to let a batch build up
    await condition(() => itemsToAssign.length >= MAX_BATCH_SIZE, '10s')
    
    while (itemsToAssign.length) {
      const slice = getBatchNextBatchSlice(itemsToAssign.length)
      const items = itemsToAssign.splice(0, slice.count)
      const batchId = slice.batchId
  
      console.log('assignment', { items, batchId, itemsLeft: itemsToAssign.length })
  
      await ensureBatchProcessorWorkflowForItems({ items, batchId })
    }
  }

  await continueAsNew<typeof batchIdAssignerSingletonWorkflow>({
    initialState: {
      currentBatchId,
      currentBatchItemCount
    }
  })
}
