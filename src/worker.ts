import { Worker } from '@temporalio/worker'
import * as activities from './activities'
import { BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID, DEFAULT_TASK_QUEUE, temporalClient } from './shared'
import { batchIdAssignerSingletonWorkflow } from './workflows'

async function initializeBatchAssignerSingleton() {
  // Start the batch id assigner workflow if it's not currently running
  await temporalClient.start(batchIdAssignerSingletonWorkflow, {
    workflowId: BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID,
    taskQueue: DEFAULT_TASK_QUEUE,
    args: []
  })
}

async function run() {
  // Step 1: Register Workflows and Activities with the Worker and connect to
  // the Temporal server.
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflows'),
    activities,
    taskQueue: DEFAULT_TASK_QUEUE
  })
  // Worker connects to localhost by default and uses console.error for logging.
  // Customize the Worker by passing more options to create():
  // https://typescript.temporal.io/api/classes/worker.Worker
  // If you need to configure server connection parameters, see docs:
  // https://docs.temporal.io/docs/typescript/security#encryption-in-transit-with-mtls

  // Step 2: Start accepting tasks on the `DEFAULT_TASK_QUEUE` queue
  await worker.run()

  await initializeBatchAssignerSingleton()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
