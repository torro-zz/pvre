declare module 'app-store-scraper' {
  interface SearchOptions {
    term: string
    num?: number
    page?: number
    country?: string
    lang?: string
  }

  interface ReviewsOptions {
    id: number
    page?: number
    country?: string
    sort?: string
  }

  interface AppResult {
    id: number
    appId: string
    title: string
    description?: string
    developer: string
    score: number
    reviews?: number
    icon?: string
    url: string
  }

  interface ReviewResult {
    id: string
    userName: string
    date: string
    score: number
    title: string
    text: string
    url?: string
    version?: string
  }

  export function search(options: SearchOptions): Promise<AppResult[]>
  export function reviews(options: ReviewsOptions): Promise<ReviewResult[]>
  export function app(options: { id: number | string; country?: string }): Promise<AppResult>

  export const sort: {
    RECENT: string
    HELPFUL: string
  }

  export const collection: Record<string, string>
  export const category: Record<string, number>
  export const device: Record<string, number>
  export const markets: Record<string, string>
}
