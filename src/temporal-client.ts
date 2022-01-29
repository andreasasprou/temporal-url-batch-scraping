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
