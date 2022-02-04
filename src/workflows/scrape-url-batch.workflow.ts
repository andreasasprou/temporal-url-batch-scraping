import { continueAsNew, getExternalWorkflowHandle, setHandler, sleep, condition, ExternalWorkflowHandle } from '@temporalio/workflow'
import { BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID, SCRAPE_INTERVAL, CONTINUE_AS_NEW_THRESHOLD, getScrapedUrlStateWorkflowId } from '../shared'
import { addedToBatchSignal, removedItemFromBatchSignal, addItemsToBatchSignal, removeItemsFromBatchSignal } from '../signals'

import { proxyActivities } from '@temporalio/workflow'
// Only import the activity types
import type * as activities from '../activities'
import { getItemsInBatchQuery } from '../queries'

const MAX_ITERATIONS = 1000
const NOTIFICATION_BATCH_SIZE = 50

const { scrapeUrls: scrapeUrlsActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute'
})

interface BatchWorkflowPayload {
  batchId: number
  initialState?: {
    items: string[]
    itemsAddedToNotify: string[]
    itemsRemovedToNotify: string[]
  }
}

export async function scrapeUrlBatchWorkflow({ batchId, initialState }: BatchWorkflowPayload) {
  let items: string[] = initialState?.items ?? []
  let itemsAddedToNotify: string[] = initialState?.itemsAddedToNotify ?? []
  let itemsRemovedToNotify: string[] = initialState?.itemsRemovedToNotify ?? []

  const notifyItemAdded = async (item: string) => {
    console.log('notify item added', item)

    await handleForItem(item).signal(addedToBatchSignal, {
      batchId,
    })
  }

  const notifyItemRemoved = async (item: string) => {
    console.log('notify item removed', item)

    await handleForAssigner().signal(removedItemFromBatchSignal, {
      batchId
    })
  }

  setHandler(getItemsInBatchQuery, () => items)

  setHandler(addItemsToBatchSignal, async ({ items }) => {
    console.log('items added', items)
    
    items.push(...items)
    itemsAddedToNotify.push(...items)
  })

  setHandler(removeItemsFromBatchSignal, async ({ items }) => {
    console.log('items removed', items)

    items = items.filter((i) => !items.includes(i))
    
    itemsRemovedToNotify.push(...items)
  })

  // These functions control the interaction with the rest of the system
  // and define how to process the batch. The rest of this code is generic.
  const handleForAssigner = (): ExternalWorkflowHandle => {
    return getExternalWorkflowHandle(BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID)
  }

  const handleForItem = (item: string): ExternalWorkflowHandle => {
    return getExternalWorkflowHandle(getScrapedUrlStateWorkflowId(item))
  }

  const scrapeUrls = async () => {
    await scrapeUrlsActivity({ urls: items })
  }

  const processBatch = async() => {
    console.log('processing batch', items)

    await scrapeUrls()
    await sleep(SCRAPE_INTERVAL)
  }
  // End of custom functions

  // We continue-as-new at least every day to aid in the cleanup of old code versions.
  let TimeToContinueAsNew = false
  sleep(CONTINUE_AS_NEW_THRESHOLD).then(() => TimeToContinueAsNew = true)

  for (let iteration = 1; iteration <= MAX_ITERATIONS; ++iteration) {
    // Wait until we have some work to do or it's time to continue as new.
    await condition(() => items.length > 0 || itemsAddedToNotify.length > 0 || itemsRemovedToNotify.length > 0 || TimeToContinueAsNew)
    if (TimeToContinueAsNew) { break }

    while (itemsAddedToNotify.length) {
      const notifications = itemsAddedToNotify.splice(0, NOTIFICATION_BATCH_SIZE).map(notifyItemAdded)
      // TODO: Check for failures here
      await Promise.allSettled(notifications)
    }

    while (itemsRemovedToNotify.length) {
      const notifications = itemsRemovedToNotify.splice(0, NOTIFICATION_BATCH_SIZE).map(notifyItemRemoved)
      // TODO: Check for failures here
      await Promise.allSettled(notifications)
    }

    if (items.length) {
      await processBatch()
    }
  }

  await continueAsNew<typeof scrapeUrlBatchWorkflow>({
    batchId,
    initialState: {
      items,
      itemsAddedToNotify,
      itemsRemovedToNotify
    }
  })
}
