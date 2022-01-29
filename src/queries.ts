import { defineQuery } from '@temporalio/workflow'

export const getBatchIdGapsQuery = defineQuery<Map<number, number>>('getBatchIdGapsQuery')

export const getUrlsInBatchQuery = defineQuery<string[]>('getUrlsInBatchQuery')
