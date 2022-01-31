export function useBatchIsGapsState() {
  const batchIdToNumberOfGaps: Map<number, number> = new Map()

  return {
    incNumberOfGaps: (batchId: number) => {
      batchIdToNumberOfGaps.set(batchId, (batchIdToNumberOfGaps.get(batchId) ?? 0) + 1)
    },
    batchIdToNumberOfGaps,
    pullFirstBatchIdWithGap: (): number | undefined => {
      const hasBatchWithGap = batchIdToNumberOfGaps.size > 0

      if (!hasBatchWithGap) {
        return undefined
      }

      const firstBatchIdWithGap = batchIdToNumberOfGaps.keys().next().value as number

      batchIdToNumberOfGaps.set(firstBatchIdWithGap, (batchIdToNumberOfGaps.get(firstBatchIdWithGap) ?? 0) - 1)

      if (batchIdToNumberOfGaps.get(firstBatchIdWithGap) === 0) {
        batchIdToNumberOfGaps.delete(firstBatchIdWithGap)
      }

      return firstBatchIdWithGap
    }
  }
}
