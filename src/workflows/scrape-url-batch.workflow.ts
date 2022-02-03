import { continueAsNew, getExternalWorkflowHandle, setHandler, sleep, condition } from '@temporalio/workflow'
import { BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID, SCRAPE_INTERVAL, CONTINUE_AS_NEW_THRESHOLD, getScrapedUrlStateWorkflowId } from '../shared'
import { newGapSignal, startScrapingUrlSignal, stopScrapingUrlSignal, batchIdAssignedSignal, BatchIdAssignedSignalPayload } from '../signals'

import { proxyActivities } from '@temporalio/workflow'
// Only import the activity types
import type * as activities from '../activities'
import { getUrlsInBatchQuery } from '../queries'

const MAX_ITERATIONS = 1000
const NOTIFICATION_BATCH_SIZE = 50

const { scrapeUrls: scrapeUrlsActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute'
})

interface ScrapeUrlBatchWorkflowPayload {
  batchId: number
  initialState?: {
    urlsToScrape: string[]
    urlsToNotify: string[]
  }
}

export async function scrapeUrlBatchWorkflow({ batchId, initialState }: ScrapeUrlBatchWorkflowPayload) {
  let urlsToScrape: string[] = initialState?.urlsToScrape ?? []
  let urlsToNotify: string[] = initialState?.urlsToNotify ?? []

  const notifyStateWorkflowWithItsNewBatchId = async (url: string) => {
    const handle = getExternalWorkflowHandle(getScrapedUrlStateWorkflowId(url))

    console.log('notify url state workflow', { url, batchId })

    return handle.signal(batchIdAssignedSignal, {
      batchId,
      url
    })
  }

  setHandler(startScrapingUrlSignal, async ({ urls }) => {
    console.log('got new urls', urls)
    
    urlsToScrape.push(...urls)
    urlsToNotify.push(...urls)
  })

  setHandler(getUrlsInBatchQuery, () => urlsToScrape)

  const signalThatIHaveAGap = async () => {
    const handle = getExternalWorkflowHandle(BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID)

    return handle.signal(newGapSignal, {
      batchId
    })
  }

  setHandler(stopScrapingUrlSignal, async ({ url }) => {
    console.log('removing url from scrape list', url)

    urlsToScrape = urlsToScrape.filter((oldUrl) => oldUrl !== url)

    // TODO: error handling
    signalThatIHaveAGap()
  })

  const scrapeUrls = async () => {
    console.log('running activity to scrape urls', urlsToScrape)

    await scrapeUrlsActivity({ urls: urlsToScrape, batchId })
  }

  let ContinueAsNewTimerFired = false
  sleep(CONTINUE_AS_NEW_THRESHOLD).then(() => ContinueAsNewTimerFired = true )

  // Loop for MAX_ITERATIONS or until our CONTINUE_AS_NEW_THRESHOLD timer fires, whichever is shorter.
  // We continue-as-new at least every day to aid in the cleanup of old code versions.
  for (let iteration = 1; iteration <= MAX_ITERATIONS && !ContinueAsNewTimerFired; ++iteration) {
    await condition(() => urlsToScrape.length > 0 || urlsToNotify.length > 0, '1h')

    while (urlsToNotify.length) {
      const notifications = urlsToNotify.splice(0, NOTIFICATION_BATCH_SIZE).map(notifyStateWorkflowWithItsNewBatchId)
      // TODO: Check for failures here
      let results = await Promise.allSettled(notifications)
      console.log('notification results', results)
    }

    if (urlsToScrape.length) {
      await scrapeUrls()
      await sleep(SCRAPE_INTERVAL)
    }
  }

  await continueAsNew<typeof scrapeUrlBatchWorkflow>({
    batchId,
    initialState: {
      urlsToScrape,
      urlsToNotify
    }
  })
}
