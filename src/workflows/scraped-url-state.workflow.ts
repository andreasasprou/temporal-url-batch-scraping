import { condition, getExternalWorkflowHandle, setHandler } from '@temporalio/workflow'

import { BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID, getBatchProcessorWorkflowId } from '../shared'
import { batchIdAssignedSignal, assignToBatchSignal, stopScrapingUrlSignal } from '../signals'
import ms from 'ms'

interface Payload {
  url: string
}

async function requestBatchIdForUrl({ url }: Pick<Payload, 'url'>) {
  const handle = await getExternalWorkflowHandle(BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID)

  await handle.signal(assignToBatchSignal, { url })
}

async function stopScrapingUrl({
  url,
  batchId
}: Pick<Payload, 'url'> & {
  batchId: number
}) {
  console.log('Requesting new batch id')

  const handle = getExternalWorkflowHandle(getBatchProcessorWorkflowId(batchId))

  await handle!.signal(stopScrapingUrlSignal, { url })
}

const error = (message: string, ...rest: Parameters<typeof console.debug>) => console.log(`⚠️ ${message}`, ...rest)

export async function scrapedUrlStateWorkflow({ url }: Payload) {
  let batchId: number | undefined = undefined
  let didStopScraping = false

  console.log('starting to scrape url', url)

  setHandler(batchIdAssignedSignal, (payload) => {
    if (url !== payload.url) {
      error('attempted to use batch ID assigned to another url. This should not happen.', {
        url,
        payloadUrl: payload.url
      })
      return
    }

    batchId = payload.batchId

    console.log('assigned new batch ID', { url, batchId })

    // potentially add a search attribute for batch id
  })

  setHandler(stopScrapingUrlSignal, () => {
    didStopScraping = true
  })

  if (!batchId) {
    await requestBatchIdForUrl({ url })

    console.log('requested new batch ID', url)

    const TIMEOUT = '30sec'

    await condition(() => Boolean(batchId), ms('30sec'))

    if (!batchId) {
      error(`did not receive new batch ID after ${TIMEOUT}. TODO: Handle this.`)
    }
  }

  // Run forever unless we signal to stop scraping
  await condition(() => didStopScraping)

  console.log('stopping the scrape for url', url)

  if (batchId) {
    await stopScrapingUrl({
      url,
      batchId
    })
  } else {
    error('failed to stop scraping url as it was never assigned a batch ID', url)
  }

  return {
    url,
    batchId
  }
}

// ## Notes
// We don't need to continueAsNew as the event history size is fixed.