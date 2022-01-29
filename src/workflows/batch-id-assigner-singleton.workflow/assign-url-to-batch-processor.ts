import { DEFAULT_TASK_QUEUE, getBatchProcessorWorkflowId, isExternalWorkflowRunning } from '../../shared'
import { ExternalWorkflowHandle } from '@temporalio/workflow/lib/workflow-handle'
import { getExternalWorkflowHandle, startChild } from '@temporalio/workflow'
import { scrapeUrlBatchWorkflow } from '../scrape-url-batch.workflow'
import { startScrapingUrlSignal } from '../../signals'

export const assignUrlToBatchProcessorWorkflow = async (url: string, batchIdToAssignTo: number) => {
  const findOrStartBatchProcessorWorkflow = async () => {
    const workflowId = getBatchProcessorWorkflowId(batchIdToAssignTo)

    let batchProcessorHandle: Pick<ExternalWorkflowHandle, 'signal'> = getExternalWorkflowHandle(workflowId)

    // TODO: Think about race conditions

    // TODO: LOCK

    // Replace with signalWithStart once implemented https://github.com/temporalio/temporal/issues/537
    if (!(await isExternalWorkflowRunning(batchProcessorHandle))) {
      console.log('creating new batch workflow to start scraping url', url)

      batchProcessorHandle = await startChild(scrapeUrlBatchWorkflow, {
        workflowId: getBatchProcessorWorkflowId(batchIdToAssignTo),
        taskQueue: DEFAULT_TASK_QUEUE,
        args: [
          {
            batchId: batchIdToAssignTo
          }
        ]
      })
    } else {
      console.log('re-using batch workflow to start scraping url', url)
    }

    // TODO: UNLOCK

    return batchProcessorHandle
  }

  console.log('signaling to batch handler to start scraping url', url)

  const handler = await findOrStartBatchProcessorWorkflow()

  await handler.signal(startScrapingUrlSignal, {
    url
  })
}
