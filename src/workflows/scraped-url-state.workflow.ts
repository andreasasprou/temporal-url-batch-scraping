import { condition, setHandler } from '@temporalio/workflow'

import { getNextBatchIdSignal } from '../queries'
import { BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID, getBatchProcessorWorkflowId, temporalClient } from '../shared'
import { stopScrapingUrlSignal } from '../signals'

interface Payload {
  url: string
}

async function getNextBatchId({ url }: Pick<Payload, 'url'>) {
  const handle = await temporalClient.getHandle(BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID)

  const result = await handle.query(getNextBatchIdSignal, { url })

  return result.nextBatchId
}

async function stopScrapingUrl({
  url,
  batchId
}: Pick<Payload, 'url'> & {
  batchId: number
}) {
  const handle = await temporalClient.getHandle(getBatchProcessorWorkflowId(batchId))

  await handle!.signal(stopScrapingUrlSignal, { url })
}

const log = (message: string, ...rest: Parameters<typeof console.debug>) =>
  console.debug(`scrapedUrlStateWorkflow: ${message}`, ...rest)

export async function scrapedUrlStateWorkflow({ url }: Payload) {
  let batchId: number | undefined = undefined
  let didStopScraping = false

  log('starting to scrape url', url)

  if (!batchId) {
    batchId = await getNextBatchId({ url })

    log('assigned to batch', batchId)

    // potentially add a search attribute for batch id
  }

  setHandler(stopScrapingUrlSignal, () => {
    didStopScraping = true
  })

  // Run forever unless we signal to stop scraping
  await condition(() => didStopScraping)

  log('stopping the scrape for url', url)

  await stopScrapingUrl({
    url,
    batchId
  })

  return {
    url,
    batchId
  }
}

// ## Notes
// We don't need to continueAsNew as the event history size is fixed.
