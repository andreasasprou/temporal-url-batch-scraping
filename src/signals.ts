import { defineSignal } from '@temporalio/workflow'

export interface ScrapeNewUrlSignalPayload {
  url: string
}

export const startScrapingUrlSignal = defineSignal<[ScrapeNewUrlSignalPayload]>('startScrapingUrlSignal')

export interface StopScrapingUrlSignalPayload {
  url: string
}

export const stopScrapingUrlSignal = defineSignal<[StopScrapingUrlSignalPayload]>('stopScrapingUrlSignal')
