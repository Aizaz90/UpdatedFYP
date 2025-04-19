const ES_ENDPOINT = "/api";  // Using Netlify proxy
const ES_API_KEY = "RXUyeU5KWUJGQnJWV3pWdVVNWDY6ZkhGbjhITEtBLVA0VjNXcmd5WGRvdw==";

export async function getAllTrendingData({
  query = "",
  category = "",
  author = "",
  sortBy = "votes",
  page = 1,
  pageSize = 10,
}) {
  try {
    const from = (page - 1) * pageSize

    const mustClauses = []
    if (query) mustClauses.push({ match: { title: query } })
    else mustClauses.push({ match_all: {} })

    if (category && category !== "all") mustClauses.push({ term: { category } })
    if (author && author !== "all") mustClauses.push({ term: { author } })

    console.log("Making request to Elasticsearch with query:", {
      query: mustClauses,
      sort: [{ [sortBy]: "desc" }],
      from,
      size: pageSize,
    })

    const response = await fetch(`${ES_ENDPOINT}/trending/_search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: {
          bool: {
            must: mustClauses,
          },
        },
        sort: [{ [sortBy]: "desc" }],
        from: from,
        size: pageSize,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Elasticsearch request failed:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      })
      throw new Error(`Elasticsearch request failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    console.log("Elasticsearch response:", result)
    const hits = result.hits.hits.map((hit) => ({ id: hit._id, ...hit._source }))
    const total = result.hits.total.value

    return { data: hits, total: total }
  } catch (error) {
    console.error("Elasticsearch error:", error)
    return { data: [], total: 0, error: error.message }
  }
}

export async function getTrendingTopics() {
  try {
    console.log("Fetching trending topics from Elasticsearch...")
    const searchBody = {
      size: 0,
      aggs: {
        top_titles: {
          terms: {
            field: "title.keyword",
            size: 50,
          },
        },
      },
    }

    console.log("Making request to:", `${ES_ENDPOINT}/trending/_search`)
    console.log("Request body:", searchBody)

    const response = await fetch(`${ES_ENDPOINT}/trending/_search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(searchBody),
    })

    console.log("Response status:", response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error("Elasticsearch response not OK:", {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      })
      throw new Error(`Elasticsearch request failed: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    console.log("Raw Elasticsearch response:", result)
    
    if (!result.aggregations?.top_titles?.buckets) {
      console.warn("Unexpected response format:", result)
      return []
    }

    const topics = result.aggregations.top_titles.buckets.map((bucket, index) => ({
      name: bucket.key,
      size: bucket.doc_count,
      fill: `hsl(${210 - index * 4}, ${Math.max(60 - index, 30)}%, ${Math.min(50 + index, 70)}%)`,
    }))

    console.log("Processed topics:", topics)
    return topics
  } catch (error) {
    console.error("Error in getTrendingTopics:", error)
    throw error
  }
}

// Get unique categories and authors for filters
export async function getUniqueValues() {
  try {
    const response = await fetch(`${ES_ENDPOINT}/trending/_search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `ApiKey ${ES_API_KEY}`,
      },
      body: JSON.stringify({
        size: 0,
        aggs: {
          categories: {
            terms: {
              field: "category.keyword",
              size: 100,
            },
          },
          authors: {
            terms: {
              field: "author.keyword",
              size: 100,
            },
          },
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Elasticsearch request failed: ${response.statusText}`)
    }

    const result = await response.json()

    const categories = result.aggregations.categories.buckets.map((bucket) => bucket.key)
    const authors = result.aggregations.authors.buckets.map((bucket) => bucket.key)

    return { categories, authors }
  } catch (error) {
    console.error("Error fetching unique values:", error)
    return { categories: [], authors: [] }
  }
}
