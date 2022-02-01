import { continueAsNew, getExternalWorkflowHandle, setHandler, sleep, condition } from '@temporalio/workflow'
import { BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID, SCRAPE_INTERVAL, CONTINUE_AS_NEW_THRESHOLD } from '../shared'
import { newGapSignal, startScrapingUrlSignal, stopScrapingUrlSignal } from '../signals'

import { proxyActivities } from '@temporalio/workflow'
// Only import the activity types
import type * as activities from '../activities'
import { getUrlsInBatchQuery } from '../queries'

const MAX_ITERATIONS = 1000

const { scrapeUrls: scrapeUrlsActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute'
})

interface ScrapeUrlBatchWorkflowPayload {
  batchId: number
  initialState?: {
    urls: string[]
  }
}

export async function scrapeUrlBatchWorkflow({ batchId, initialState }: ScrapeUrlBatchWorkflowPayload) {
  let urls: string[] = initialState?.urls ?? []

  setHandler(startScrapingUrlSignal, ({ url }) => {
    console.log('got new url', url)
    urls.push(url)
  })

  setHandler(getUrlsInBatchQuery, () => urls)

  const signalThatIHaveAGap = async () => {
    const handle = getExternalWorkflowHandle(BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID)

    await handle.signal(newGapSignal, {
      batchId
    })

    console.log('signalled that I have a new gap')
  }

  setHandler(stopScrapingUrlSignal, ({ url }) => {
    console.log('removing url from scrape list', url)

    urls = urls.filter((oldUrl) => oldUrl !== url)

    void signalThatIHaveAGap()
  })

  const scrapeUrls = async () => {
    if (urls.length === 0) {
      return
    }

    console.log('running activity to scrape urls', urls)

    await scrapeUrlsActivity({ urls, batchId })
  }

  let ContinueAsNewTimerFired = false
  sleep(CONTINUE_AS_NEW_THRESHOLD).then(() => ContinueAsNewTimerFired = true )

  // Loop for MAX_ITERATIONS or until our CONTINUE_AS_NEW_THRESHOLD timer fires, whichever is shorter.
  // We continue-as-new at least every day to aid in the cleanup of old code versions.
  for (let iteration = 1; iteration <= MAX_ITERATIONS && !ContinueAsNewTimerFired; ++iteration) {
    // Avoid spinning too quickly if we have no work to do.
    await condition(() => urls.length > 0, '1 hour')

    if (urls.length) {
      await scrapeUrls()
    }
    await sleep(SCRAPE_INTERVAL)
  }

  await continueAsNew<typeof scrapeUrlBatchWorkflow>({
    batchId,
    initialState: {
      urls
    }
  })
}
