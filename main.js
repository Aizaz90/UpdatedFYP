console.log("main.js loaded") 

// import * as lucide from "lucide" // Import Lucide
import { getUniqueValues, getAllTrendingData } from "./elasticsearch.js" // Import API functions

console.log("Script loaded, waiting for DOM...")

document.addEventListener("DOMContentLoaded", async () => {
  try {
    console.log("DOM loaded, initializing...")
    
    // Initialize Lucide icons
    lucide.createIcons()
    console.log("Lucide icons initialized")

    // Get DOM elements
    const searchForm = document.getElementById("search-form")
    const searchInput = document.getElementById("search-query")
    const categorySelect = document.getElementById("category-select")
    const authorSelect = document.getElementById("author-select")
    const sortSelect = document.getElementById("sort-select")
    const trendingTable = document.getElementById("trending-table")
    const totalResults = document.getElementById("total-results")
    const pagination = document.getElementById("pagination")

    console.log("DOM elements retrieved")

    // Current state
    let currentPage = 1
    const pageSize = 10

    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const queryParam = urlParams.get("q") || ""
    const categoryParam = urlParams.get("category") || "all"
    const authorParam = urlParams.get("author") || "all"
    const sortParam = urlParams.get("sort") || "votes"
    const pageParam = Number.parseInt(urlParams.get("page")) || 1

    // Set initial values from URL parameters
    searchInput.value = queryParam
    sortSelect.value = sortParam
    currentPage = pageParam

    console.log("URL parameters processed")

    // Populate filter options
    try {
      console.log("Fetching unique values...")
      const { categories, authors } = await getUniqueValues()
      console.log("Unique values fetched:", { categories, authors })

      // Populate category options
      categories.forEach((category) => {
        const option = document.createElement("option")
        option.value = category
        option.textContent = category
        categorySelect.appendChild(option)
      })

      // Populate author options
      authors.forEach((author) => {
        const option = document.createElement("option")
        option.value = author
        option.textContent = author
        authorSelect.appendChild(option)
      })

      // Set selected values from URL parameters
      categorySelect.value = categoryParam
      authorSelect.value = authorParam
    } catch (error) {
      console.error("Failed to load filter options:", error)
    }

    // Load initial data
    console.log("Loading initial data...")
    await loadTrendingData()
    console.log("Initial data loaded")

    // Event listeners
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault()
      currentPage = 1
      updateURL()
      loadTrendingData()
    })

    categorySelect.addEventListener("change", () => {
      currentPage = 1
      updateURL()
      loadTrendingData()
    })

    authorSelect.addEventListener("change", () => {
      currentPage = 1
      updateURL()
      loadTrendingData()
    })

    sortSelect.addEventListener("change", () => {
      currentPage = 1
      updateURL()
      loadTrendingData()
    })

    // Functions
    async function loadTrendingData() {
      try {
        console.log("Starting loadTrendingData...")
        // Show loading state
        trendingTable.innerHTML = '<div class="p-8 text-center text-gray-500">Loading...</div>'

        console.log("Fetching data with params:", {
          query: searchInput.value,
          category: categorySelect.value,
          author: authorSelect.value,
          sortBy: sortSelect.value,
          page: currentPage,
          pageSize: pageSize,
        })

        const { data, total, error } = await getAllTrendingData({
          query: searchInput.value,
          category: categorySelect.value,
          author: authorSelect.value,
          sortBy: sortSelect.value,
          page: currentPage,
          pageSize: pageSize,
        })

        console.log("Data received:", { data, total, error })

        if (error) {
          console.error("Error in data fetch:", error)
          trendingTable.innerHTML = `
            <div class="p-4 bg-red-50 text-red-500 rounded-md">
              <div class="flex items-start gap-2">
                <i data-lucide="alert-circle" class="h-5 w-5"></i>
                <div>
                  <div class="font-medium">Error</div>
                  <div>${error}</div>
                </div>
              </div>
            </div>
          `
          lucide.createIcons()
          return
        }

        // Update total results
        totalResults.textContent = `Total results: ${total}`

        // Render data
        if (data.length === 0) {
          trendingTable.innerHTML =
            '<div class="p-8 text-center text-gray-500">No results found. Try adjusting your search or filters.</div>'
        } else {
          console.log("Rendering data items:", data.length)
          trendingTable.innerHTML = data
            .map(
              (item) => `
            <div class="p-4 hover:bg-gray-50 transition-colors">
              <div class="flex items-start gap-4">
                <div class="flex flex-col items-center gap-1 pt-1">
                  <i data-lucide="arrow-up-circle" class="h-5 w-5 text-primary"></i>
                  <span class="text-sm font-medium">${item.votes}</span>
                </div>
                
                <div class="flex-1 space-y-1">
                  <h3 class="font-medium leading-tight">${item.title}</h3>
                  <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                    <span class="px-2 py-0.5 text-xs border border-gray-200 rounded-full">${item.category}</span>
                    <span>by ${item.author}</span>
                    <span>${formatDate(item.date)}</span>
                    <div class="flex items-center gap-1">
                      <i data-lucide="message-circle" class="h-3.5 w-3.5"></i>
                      <span>${item.comments}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          `,
            )
            .join("")

          // Re-initialize icons in the newly added content
          lucide.createIcons()
        }

        // Render pagination
        renderPagination(total)
      } catch (error) {
        console.error("Error in loadTrendingData:", error)
        trendingTable.innerHTML = `
          <div class="p-4 bg-red-50 text-red-500 rounded-md">
            <div class="flex items-start gap-2">
              <i data-lucide="alert-circle" class="h-5 w-5"></i>
              <div>
                <div class="font-medium">Error</div>
                <div>Failed to load trending data. Please try again later.</div>
              </div>
            </div>
          </div>
        `
        lucide.createIcons()
      }
    }

    function renderPagination(total) {
      const totalPages = Math.ceil(total / pageSize)

      if (totalPages <= 1) {
        pagination.innerHTML = ""
        return
      }

      let paginationHTML = ""

      // Previous button
      paginationHTML += `
        <a href="#" class="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 border border-gray-200 rounded-md ${
          currentPage <= 1 ? "opacity-50 pointer-events-none" : "hover:bg-gray-50"
        }" 
           data-page="${currentPage - 1}" aria-label="Previous page">
          <i data-lucide="chevron-left" class="h-4 w-4"></i>
        </a>
      `

      // Page numbers
      const maxPages = Math.min(5, totalPages)
      let startPage = 1

      if (currentPage > 3) {
        startPage = Math.min(currentPage - 2, totalPages - maxPages + 1)
      }

      for (let i = 0; i < maxPages; i++) {
        const pageNum = startPage + i
        if (pageNum <= totalPages) {
          paginationHTML += `
            <a href="#" class="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 border ${
              pageNum === currentPage ? "bg-primary text-white border-primary" : "border-gray-200 hover:bg-gray-50"
            } rounded-md" 
               data-page="${pageNum}">
              ${pageNum}
            </a>
          `
        }
      }

      // Next button
      paginationHTML += `
        <a href="#" class="inline-flex items-center justify-center min-w-[2rem] h-8 px-2 border border-gray-200 rounded-md ${
          currentPage >= totalPages ? "opacity-50 pointer-events-none" : "hover:bg-gray-50"
        }" 
           data-page="${currentPage + 1}" aria-label="Next page">
          <i data-lucide="chevron-right" class="h-4 w-4"></i>
        </a>
      `

      pagination.innerHTML = paginationHTML

      // Initialize icons in pagination
      lucide.createIcons()

      // Add event listeners to pagination items
      const paginationItems = pagination.querySelectorAll("a")
      paginationItems.forEach((item) => {
        if (!item.classList.contains("opacity-50")) {
          item.addEventListener("click", function (e) {
            e.preventDefault()
            const page = Number.parseInt(this.getAttribute("data-page"))
            if (page !== currentPage) {
              currentPage = page
              updateURL()
              loadTrendingData()
              window.scrollTo(0, 0)
            }
          })
        }
      })
    }

    function updateURL() {
      const params = new URLSearchParams()
      if (searchInput.value) params.set("q", searchInput.value)
      if (categorySelect.value !== "all") params.set("category", categorySelect.value)
      if (authorSelect.value !== "all") params.set("author", authorSelect.value)
      if (sortSelect.value !== "votes") params.set("sort", sortSelect.value)
      if (currentPage > 1) params.set("page", currentPage)

      const newUrl = `${window.location.pathname}${params.toString() ? "?" + params.toString() : ""}`
      window.history.pushState({}, "", newUrl)
    }

    function formatDate(dateString) {
      const date = new Date(dateString)
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    }
  } catch (error) {
    console.error("Failed to initialize:", error)
  }
})
