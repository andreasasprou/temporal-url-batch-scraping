import { temporalClient } from './temporal-client'
import { scrapeUrlBatchWorkflow } from './workflows'
import { startScrapingUrlSignal } from './signals'
import { DEFAULT_TASK_QUEUE, getBatchProcessorWorkflowId } from './shared'
import ms from 'ms'
import { Context } from '@temporalio/activity'

interface EnsureBatchProcessorWorkflowForURLPayload {
  batchId: number
  url: string
}

interface ScrapeUrlPayload {
  urls: string[]
  batchId: number
}

const sleep = (time: string) => new Promise((res) => setTimeout(res, ms(time)))

async function tryScrape(url: string) {
  await sleep(`${Math.random() * 400}ms`)

  if (Math.random() > 0.7) {
    console.log('throwing test error for url', url)
    throw new Error('Rate limited')
  }
}

export async function ensureBatchProcessorWorkflowForURL({ batchId, url }: EnsureBatchProcessorWorkflowForURLPayload) {
  await temporalClient.signalWithStart(scrapeUrlBatchWorkflow, {
    workflowId: getBatchProcessorWorkflowId(batchId),
    args: [{ batchId }],
    taskQueue: DEFAULT_TASK_QUEUE,
    signal: startScrapingUrlSignal,
    signalArgs: [{ url }]
  })
}

interface HeartbeatDetails {
  failedUrlsInLastAttempt?: string[]
}

export async function scrapeUrls({ urls: urlsFromFirstAttempt, batchId }: ScrapeUrlPayload): Promise<void> {
  console.log(Context.current().info)
  const failedUrlsFromLastAttempt = (Context.current().info.heartbeatDetails as HeartbeatDetails | undefined)?.failedUrlsInLastAttempt

  const urlsToProcess = failedUrlsFromLastAttempt ?? urlsFromFirstAttempt

  if (failedUrlsFromLastAttempt) {
    console.log('re-trying failed urls', { urlsToProcess, batchId })
  } else {
    console.log('scraping urls', { urlsToProcess, batchId })
  }

  const failedUrls: string[] = []

  // TODO: use something like p-props to limit concurrency
  await Promise.allSettled(
    urlsToProcess.map(async (url) => {
      try {
        await tryScrape(url)

        // Let Temporal know we're still alive for long-running activities (e.g. huge batch size)
        console.log('scraped ok')
      } catch (error) {
        console.error('scrape failed', error)
        failedUrls.push(url)
      }

      Context.current().heartbeat({ failedUrlsInLastAttempt: failedUrls })
    })
  )

  if (failedUrls.length > 0) {
    console.log('failed urls', { failedUrls, batchId })
    throw new Error('Failed to process all urls')
  }
}
