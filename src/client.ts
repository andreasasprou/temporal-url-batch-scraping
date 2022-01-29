import {
  BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID,
  DEFAULT_TASK_QUEUE,
  getScrapedUrlStateWorkflowId,
  SCRAPE_INTERVAL
} from './shared'
import { temporalClient } from './temporal-client'
import { scrapedUrlStateWorkflow } from './workflows'
import { stopScrapingUrlSignal } from './signals'
import ms from 'ms'
import { getBatchIdGapsQuery } from './queries'
import assert from 'assert'

const urls = [
  'https://url1.com',
  'https://url2.com',
  'https://url3.com',
  'https://url4.com',
  'https://url5.com',
  'https://url6.com'
]

const sleep = (time: string) => new Promise((res) => setTimeout(res, ms(time)))

const getBatchIdsMapFromWorkflow = async () => {
  const batchIDAssignerWorkflow = await temporalClient.getHandle(BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID)

  return await batchIDAssignerWorkflow.query(getBatchIdGapsQuery)
}

async function run() {
  await Promise.all(
    urls.map(async (url) => {
      const handle = await temporalClient.start(scrapedUrlStateWorkflow, {
        args: [
          {
            url
          }
        ],
        taskQueue: DEFAULT_TASK_QUEUE,
        workflowId: getScrapedUrlStateWorkflowId(url)
      })

      console.log(`Started workflow ${handle.workflowId} for url "${url}"`)
    })
  )

  return

  const stopScraping = async () => {
    const firstUrl = urls[0]

    console.log('signalling to stop scraping url', firstUrl)

    const firstUrlHandle = await temporalClient.getHandle(getScrapedUrlStateWorkflowId(firstUrl))

    await firstUrlHandle.signal(stopScrapingUrlSignal, {
      url: firstUrl
    })
  }

  await sleep('38s')

  // should scrape all urls

  await stopScraping()

  // wait till next scrape
  await sleep(SCRAPE_INTERVAL)

  // Check logs - it should now scrape all urls except the first one via 3 activities

  const batchIdGapsBeforeRebalancing = await getBatchIdsMapFromWorkflow()

  console.log('batchIdGapsBeforeRebalancing', batchIdGapsBeforeRebalancing)

  assert(batchIdGapsBeforeRebalancing.size === 0, 'the batch id assigner should know about a gap!')

  // Now, let's test re-balancing by adding a new URL, it should attempt to assign the new url to the gap, instead of creating a new batch

  const newUrl = 'https://url7.com'

  await temporalClient.start(scrapedUrlStateWorkflow, {
    args: [
      {
        url: newUrl
      }
    ],
    taskQueue: DEFAULT_TASK_QUEUE,
    workflowId: getScrapedUrlStateWorkflowId(newUrl)
  })

  // wait till next scrape
  await sleep(SCRAPE_INTERVAL)

  // Check logs - you should see three activities: all processing 2 urls

  const batchIdGapsAfterRebalancing = await getBatchIdsMapFromWorkflow()

  console.log('batchIdGapsAfterRebalancing', batchIdGapsAfterRebalancing)

  assert(batchIdGapsAfterRebalancing.size > 0, 'the batch id assigner should not know about any gaps!')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
