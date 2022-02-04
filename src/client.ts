import {
  BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID,
  DEFAULT_TASK_QUEUE,
  getScrapedUrlStateWorkflowId,
  MAX_BATCH_SIZE,
  SCRAPE_INTERVAL
} from './shared'
import { temporalClient } from './temporal-client'
import { scrapedUrlStateWorkflow } from './workflows'
import { removeItemsFromBatchSignal } from './signals'
import ms from 'ms'
import { getBatchIdGapsQuery } from './queries'
import { TemporalGRPCError } from './shared'
import assert from 'assert'

const urls = Array(500).fill(null).map((_, i) => 'https://url' + i + '.com')

const sleep = (time: string) => new Promise((res) => setTimeout(res, ms(time)))

const getBatchIdsMapFromWorkflow = async () => {
  const batchIDAssignerWorkflow = await temporalClient.getHandle(BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID)

  return await batchIDAssignerWorkflow.query(getBatchIdGapsQuery)
}

async function run() {
  console.time('assignment')

  await Promise.allSettled(
    urls.map(async (url) => {
      try {
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

        await handle.result()
      } catch (error) {
        if ((error as TemporalGRPCError).code == 6) {
          console.log('workflow already running')
        } else {
          console.log('error', error)
        }
      }
    })
  )

  console.timeEnd('assignment')

  return

  const stopScraping = async () => {
    const firstUrl = urls[0]

    console.log('signalling to stop scraping url', firstUrl)

    const firstUrlHandle = await temporalClient.getHandle(getScrapedUrlStateWorkflowId(firstUrl))

    await firstUrlHandle.signal(removeItemsFromBatchSignal, {
      items: [firstUrl]
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

  // assert(batchIdGapsBeforeRebalancing.size > 0, 'the batch id assigner should know about a gap!')

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

  const anotherNewUrl = 'https://url8.com'
  await temporalClient.start(scrapedUrlStateWorkflow, {
    args: [
      {
        url: anotherNewUrl
      }
    ],
    taskQueue: DEFAULT_TASK_QUEUE,
    workflowId: getScrapedUrlStateWorkflowId(anotherNewUrl)
  })

  // wait till next scrape
  await sleep(SCRAPE_INTERVAL)

  // Check logs - you should see three activities: all processing 2 urls

  const batchIdGapsAfterRebalancing = await getBatchIdsMapFromWorkflow()

  console.log('batchIdGapsAfterRebalancing', batchIdGapsAfterRebalancing)

  // assert(batchIdGapsAfterRebalancing.size === 0, 'the batch id assigner should not know about any gaps!')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
