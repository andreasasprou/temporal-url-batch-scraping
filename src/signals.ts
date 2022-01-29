import { defineSignal } from '@temporalio/workflow'

type PayloadWithUrl = {
  url: string
}

export type ScrapeNewUrlSignalPayload = PayloadWithUrl

export const startScrapingUrlSignal = defineSignal<[ScrapeNewUrlSignalPayload]>('startScrapingUrlSignal')

export type StopScrapingUrlSignalPayload = PayloadWithUrl

export const stopScrapingUrlSignal = defineSignal<[StopScrapingUrlSignalPayload]>('stopScrapingUrlSignal')

export type AssignToBatchSignalPayload = PayloadWithUrl

export const assignToBatchSignal = defineSignal<[AssignToBatchSignalPayload]>('assignToBatchSignal')

export type BatchIdAssignedSignalPayload = PayloadWithUrl & {
  batchId: number
}

export const batchIdAssignedSignal = defineSignal<[BatchIdAssignedSignalPayload]>('requestNewBatchIdSignal')

export type NewGapSignal = {
  batchId: number
}

export const newGapSignal = defineSignal<[NewGapSignal]>('newGapSignal')
