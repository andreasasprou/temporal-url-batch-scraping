import { condition, continueAsNew, getExternalWorkflowHandle, setHandler, sleep } from '@temporalio/workflow'
import { BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID, SCRAPE_INTERVAL } from '../shared'
import ms from 'ms'
import { newGapSignal, startScrapingUrlSignal, stopScrapingUrlSignal } from '../signals'

import { proxyActivities } from '@temporalio/workflow'
// Only import the activity types
import type * as activities from '../activities'
import { getUrlsInBatchQuery } from '../queries'

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

  const scrapeUrls = async (urlsToScrape: string[]) => {
    console.log('running activity to scrape urls', urlsToScrape)

    await scrapeUrlsActivity({ urls: urlsToScrape, batchId })
  }

  while (true) {
    await condition(() => urls.length > 0)
    await scrapeUrls(urls)

    await sleep(ms(SCRAPE_INTERVAL))

    numberOfIterations += 1

    // TODO: Replace with api to get event history when available
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
