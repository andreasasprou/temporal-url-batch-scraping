import { condition, getExternalWorkflowHandle, setHandler } from '@temporalio/workflow'

import { BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID, getBatchProcessorWorkflowId } from '../shared'
import { batchIdAssignedSignal, assignToBatchSignal, stopScrapingUrlSignal } from '../signals'

interface Payload {
  url: string
}

async function requestBatchIdForUrl({ url }: Pick<Payload, 'url'>) {
  const handle = getExternalWorkflowHandle(BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID)

  await handle.signal(assignToBatchSignal, { url })
}

async function stopScrapingUrl({
  url,
  batchId
}: Pick<Payload, 'url'> & {
  batchId: number
}) {
  const handle = getExternalWorkflowHandle(getBatchProcessorWorkflowId(batchId))

  await handle.signal(stopScrapingUrlSignal, { url })
}

const error = (message: string, ...rest: Parameters<typeof console.debug>) => console.log(`⚠️ ${message}`, ...rest)

export async function scrapedUrlStateWorkflow({ url }: Payload) {
  let batchId: number | undefined = undefined
  let didStopScraping = false

  setHandler(batchIdAssignedSignal, (payload) => {
    if (url !== payload.url) {
      error('attempted to use batch ID assigned to another url. This should not happen.', {
        url,
        payloadUrl: payload.url
      })
      return
    }

    batchId = payload.batchId

    console.log('received batch id', { url, batchId })
  })

  setHandler(stopScrapingUrlSignal, () => {
    didStopScraping = true
  })

  if (batchId === undefined) {
    await requestBatchIdForUrl({ url })
  }

  await condition(() => batchId !== undefined)

  return {
    url,
    batchId
  }

  // Run forever unless we signal to stop scraping
  // await condition(() => didStopScraping)

  // console.log('stopping the scrape for url', url)

  // if (batchId === undefined) {
  //   error('failed to stop scraping url as it was never assigned a batch ID', url)
  // } else {
  //   await stopScrapingUrl({
  //     url,
  //     batchId
  //   })
  // }
  
  // return {
  //   url,
  //   batchId
  // }
}

// ## Notes
// We don't need to continueAsNew as the event history size is fixed.
