import { continueAsNew, setHandler, sleep } from '@temporalio/workflow'
import { SCRAPE_FREQUENCY } from '../shared'
import ms from 'ms'
import { startScrapingUrlSignal, stopScrapingUrlSignal } from '../signals'

import { proxyActivities } from '@temporalio/workflow'
// Only import the activity types
import type * as activities from '../activities'

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
  let numberOfIterations = 0
  let urls: string[] = initialState?.urls ?? []

  // TODO: ensure we never run this handler whilst we're executing the core functionality
  setHandler(startScrapingUrlSignal, async ({ url }) => {
    console.log('got new url', url)
    urls.push(url)
  })

  // TODO: ensure we never run this handler whilst we're executing the core functionality
  setHandler(stopScrapingUrlSignal, ({ url }) => {
    console.log('removing url from scrape list', url)

    urls = urls.filter((oldUrl) => oldUrl !== url)

    // TODO: Signal that we have a gap
  })

  const scrapeUrls = async () => {
    if (urls.length === 0) {
      return
    }

    console.log('running activity to scrape urls', urls)

    await scrapeUrlsActivity({ urls, batchId })
  }

  while (true) {
    await scrapeUrls()

    await sleep(ms(SCRAPE_FREQUENCY))

    numberOfIterations += 1

    // TODO: Document this estimate
    const shouldContinueAsNew = numberOfIterations === 300

    if (shouldContinueAsNew) {
      await continueAsNew<typeof scrapeUrlBatchWorkflow>({
        batchId,
        initialState: {
          urls
        }
      })
    }
  }
}
