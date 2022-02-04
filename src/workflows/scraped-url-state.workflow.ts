import { condition, getExternalWorkflowHandle, setHandler, isCancellation, CancellationScope } from '@temporalio/workflow'

import { BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID, getBatchProcessorWorkflowId } from '../shared'
import { addedToBatchSignal, assignToBatchSignal, removeItemsFromBatchSignal } from '../signals'

interface Payload {
  url: string
}

async function assignToBatch({ url }: Pick<Payload, 'url'>) {
  const handle = getExternalWorkflowHandle(BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID)

  await handle.signal(assignToBatchSignal, { item: url })
}

async function removeFromBatch({
  url,
  batchId
}: Pick<Payload, 'url'> & {
  batchId: number | undefined
}) {
  if (!batchId) {
    return
  }

  const handle = getExternalWorkflowHandle(getBatchProcessorWorkflowId(batchId))

  await handle.signal(removeItemsFromBatchSignal, { items: [url] })
}

export async function scrapedUrlStateWorkflow({ url }: Payload) {
  let batchId: number | undefined = undefined

  setHandler(addedToBatchSignal, ({ batchId: newBatchId }) => {
    batchId = newBatchId

    console.log('added to batch', { url, batchId })
  })

  await assignToBatch({ url })
  await condition(() => batchId !== undefined)

  return

  // try {
  //   await condition(() => false)
  // } catch(e) {
  //   if (isCancellation(e)) {
  //     return CancellationScope.nonCancellable(() => removeFromBatch({ url, batchId }))
  //   } else {
  //     throw e
  //   }
  // }
}
