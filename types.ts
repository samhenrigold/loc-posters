export interface APIResponse {
    pagination: Pagination
    results: Result[]
  }
  
  export interface Pagination {
    next: string | null
  }
  
  export interface Result {
    date: string
    description?: string[]
    image_url: string[]
    subject?: string[]
    item: Item
    id: string  // Adding this as it's usually important for unique identification
  }
  
  export interface Item {
    title: string
    summary: any  // Keeping this as 'any' since the original type was 'any'
    medium?: string[]
  }
  
  export interface Poster {
    id: string
    date: string | null
    description: string | null
    image_url: string[]
    subject?: string[]
    title: string
    summary: any
    medium: string | null
    safe?: boolean;
    content_warning?: string | null;
  }  
  
  
  // This represents your entire database structure
  export interface Schema {
    posters: Poster[]
  }