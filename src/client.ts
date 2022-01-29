import { DEFAULT_TASK_QUEUE, getScrapedUrlStateWorkflowId } from './shared'
import { temporalClient } from './temporal-client'
import { scrapedUrlStateWorkflow } from './workflows'

async function run() {
  const url = 'https://github.com/temporalio/sdk-typescript/blob/HEAD/CHANGELOG.md'

  const handle = await temporalClient.start(scrapedUrlStateWorkflow, {
    args: [
      {
        url
      }
    ],
    taskQueue: DEFAULT_TASK_QUEUE,
    workflowId: getScrapedUrlStateWorkflowId(url)
  })

  console.log(`Started workflow ${handle.workflowId}`)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
