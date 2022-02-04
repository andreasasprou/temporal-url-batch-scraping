import { defineQuery } from '@temporalio/workflow'

export const getBatchIdGapsQuery = defineQuery<Map<number, number>>('getBatchIdGapsQuery')

export const getItemsInBatchQuery = defineQuery<string[]>('getItemsInBatchQuery')
