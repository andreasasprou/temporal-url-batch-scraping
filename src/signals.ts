import { defineSignal } from '@temporalio/workflow'

type PayloadWithItem = {
  item: string
}

type PayloadWithItems = {
  items: string[]
}

type PayloadWithBatchId = {
  batchId: number
}

export type AssignToBatchSignalPayload = PayloadWithItem

export const assignToBatchSignal = defineSignal<[AssignToBatchSignalPayload]>('assignToBatchSignal')

export type AddItemsToBatchSignalPayload = PayloadWithItems

export const addItemsToBatchSignal = defineSignal<[AddItemsToBatchSignalPayload]>('addItemsToBatchSignal')

export type RemoveItemsFromBatchSignalPayload = PayloadWithItems

export const removeItemsFromBatchSignal = defineSignal<[RemoveItemsFromBatchSignalPayload]>('removeItemsFromBatchSignal')

export type AddedToBatchSignalPayload = PayloadWithBatchId

export const addedToBatchSignal = defineSignal<[AddedToBatchSignalPayload]>('addedToBatchSignal')

export type RemovedItemFromBatchSignal = PayloadWithBatchId

export const removedItemFromBatchSignal = defineSignal<[RemovedItemFromBatchSignal]>('removedItemFromBatchSignal')
