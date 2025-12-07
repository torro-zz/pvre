// Arctic Shift API Types

export interface RedditPost {
  id: string
  title: string
  selftext: string
  author: string
  subreddit: string
  score: number
  num_comments: number
  created_utc: number
  url: string
  permalink: string
  link_flair_text?: string
  over_18?: boolean
  spoiler?: boolean
}

export interface RedditComment {
  id: string
  body: string
  author: string
  subreddit: string
  score: number
  created_utc: number
  link_id: string
  parent_id: string
  permalink: string
}

export interface Subreddit {
  name: string
  title: string
  description: string
  subscribers: number
  created_utc: number
  over18: boolean
}

export interface SearchPostsParams {
  subreddit?: string
  author?: string
  title?: string
  selftext?: string
  query?: string
  after?: string   // ISO date string or Unix timestamp
  before?: string  // ISO date string or Unix timestamp
  limit?: number | 'auto'   // 1-100, or 'auto' for up to 1000 based on server capacity
  sort?: 'asc' | 'desc'
}

export interface SearchCommentsParams {
  subreddit?: string
  author?: string
  body?: string
  link_id?: string
  parent_id?: string
  after?: string
  before?: string
  limit?: number | 'auto'   // 1-100, or 'auto' for up to 1000 based on server capacity
  sort?: 'asc' | 'desc'
}

export interface SearchSubredditsParams {
  subreddit_prefix?: string
  limit?: number
}

export interface ArcticShiftResponse<T> {
  data: T[]
}
