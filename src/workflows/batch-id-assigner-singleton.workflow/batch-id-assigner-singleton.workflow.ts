import { getScrapedUrlStateWorkflowId, MAX_BATCH_SIZE } from '../../shared'
import { assignToBatchSignal, batchIdAssignedSignal, BatchIdAssignedSignalPayload, newGapSignal } from '../../signals'
import {
  continueAsNew,
  getExternalWorkflowHandle,
  setHandler,
  proxyActivities,
  condition
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

export async function batchIdAssignerSingletonWorkflow({ initialState }: Payload = {}) {
  const { incNumberOfGaps, pullFirstBatchIdWithGap, batchIdToNumberOfGaps } = useBatchIsGapsState()

  setHandler(getBatchIdGapsQuery, () => batchIdToNumberOfGaps)

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

    return handle.signal(batchIdAssignedSignal, {
        batchId,
        url
    })  
  }

  const assignToBatchSignalHandler = async (url: string | undefined) => {
    if (!url) {
      return
    }

    console.log('requested new batch ID', url)

    const nextBatchId = getNextBatchId()

    console.log('next batch id', { url, nextBatchId })

    await ensureBatchProcessorWorkflowForURLActivity({ url, batchId: nextBatchId })
    
    try {
      await notifyStateWorkflowWithItsNewBatchId({
        url,
        batchId: nextBatchId
      })
    } catch (error) {
      // TODO: Unregister URL from batch here as compensation?
      console.log('⚠️ failed to signal state workflow', { error, url })
    }
  }

  const urlsToAssign: string[] = []

  setHandler(assignToBatchSignal, async ({ url }) => {
    urlsToAssign.push(url)
  })

  setHandler(newGapSignal, ({ batchId }) => incNumberOfGaps(batchId))

  // Loop for MAX_ITERATIONS or after we've received no signals for a day, whichever is sooner.
  // We continue as new if we've been inactive for a day to aid in the cleanup of old code versions.
  for (let iteration = 1; iteration <= MAX_ITERATIONS; ++iteration) {
    await condition(() => urlsToAssign.length > 0, '1 day')

    while (urlsToAssign.length > 0) {
      const nextUrlToAssign = urlsToAssign.shift()
      await assignToBatchSignalHandler(nextUrlToAssign)
    }
  }

  await continueAsNew<typeof batchIdAssignerSingletonWorkflow>({
    initialState: {
      currentBatchId,
      numberOfUrlsInCurrentBatch
    }
  })
}
