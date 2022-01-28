import { defineQuery } from '@temporalio/workflow'

export const getNextBatchIdSignal = defineQuery<Promise<{ nextBatchId: number }>, [{ url: string }]>(
  'getNextBatchIdSignal'
)
