import { Connection, WorkflowClient } from '@temporalio/client'

let _client: WorkflowClient

const getClient = () => {
  if (!_client) {
    const connection = new Connection({
      // // Connect to localhost with default ConnectionOptions.
      // // In production, pass options to the Connection constructor to configure TLS and other settings:
      // address: 'foo.bar.tmprl.cloud', // as provisioned
      // tls: {} // as provisioned
    })

    _client = new WorkflowClient(connection.service, {
      // namespace: 'default', // change if you have a different namespace
    })
  }

  return _client
}

export const temporalClient = getClient()

export const DEFAULT_TASK_QUEUE = 'url-scraper-v1'

export const BATCH_ID_ASSIGNER_SINGLETON_WORKFLOW_ID = 'batch-id-assigner-workflow-v1'

// Time unit accepted by https://www.npmjs.com/package/ms
export const SCRAPE_FREQUENCY = '10s'

export const getBatchProcessorWorkflowId = (batchId: number) => `batch-processors:${batchId}`

// TODO: Apply transformation on url to normalise it etc
export const getScrapedUrlStateWorkflowId = (url: string) => `scraped-url-state:${url}`
