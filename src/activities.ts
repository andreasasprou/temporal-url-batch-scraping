interface ScrapeUrlPayload {
  urls: string[]
  batchId: number
}

async function tryScrape(url: string) {
  console.log('scraping url', url)
}

export async function scrapeUrls({ urls, batchId }: ScrapeUrlPayload) {
  // use something like p-props to limit concurrency
  await Promise.all(
    urls.map(async (url) => {
      try {
        await tryScrape(url)

        // todo: heartbeat success
      } catch (error) {
        console.error(error)
        // TODO: heartbeat error
      }
    })
  )
}
