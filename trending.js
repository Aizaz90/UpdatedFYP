// Remove the import and use global lucide object
import { getTrendingTopics } from "./elasticsearch.js"

console.log("trending.js loaded")


  document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM loaded, initializing trending visualization...")
    
    // Initialize Lucide icons
    lucide.createIcons()
    console.log("Lucide icons initialized")

    // Get DOM elements
    const visualizationContainer = document.getElementById("visualization-container")
    const zoomInButton = document.getElementById("zoom-in")
    const zoomOutButton = document.getElementById("zoom-out")

    console.log("DOM elements retrieved:", {
      visualizationContainer,
      zoomInButton,
      zoomOutButton
    })

    // State
    let zoomLevel = 1
    let trendingTopics = []
    const bubblePositions = {}
    let hoveredBubble = null
    let isDragging = false
    let draggedBubble = null

    // Load data
    try {
      console.log("Starting to fetch trending topics...")
      visualizationContainer.innerHTML =
        '<div class="flex justify-center items-center h-full text-gray-500">Loading visualization...</div>'
      
      trendingTopics = await getTrendingTopics()
      console.log("Trending topics fetched:", trendingTopics)
      
      if (!trendingTopics || trendingTopics.length === 0) {
        console.warn("No trending topics returned from API")
        visualizationContainer.innerHTML =
          '<div class="p-8 text-center text-gray-500">No trending topics found.</div>'
        return
      }
      
      renderVisualization()
    } catch (error) {
      console.error("Failed to load trending topics:", error)
      visualizationContainer.innerHTML = `
        <div class="p-4 bg-red-50 text-red-500 rounded-md">
          <div class="flex items-start gap-2">
            <i data-lucide="alert-circle" class="h-5 w-5"></i>
            <div>
              <div class="font-medium">Error</div>
              <div>${error.message || "Failed to load trending topics. Please try again later."}</div>
            </div>
          </div>
        </div>
      `
      lucide.createIcons()
    }

    // Event listeners
    zoomInButton.addEventListener("click", () => {
      zoomLevel = Math.min(zoomLevel * 1.2, 3)
      renderVisualization()
    })

    zoomOutButton.addEventListener("click", () => {
      zoomLevel = Math.max(zoomLevel / 1.2, 0.5)
      renderVisualization()
    })

    // Handle mouse events for dragging
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    function renderVisualization() {
      if (!trendingTopics.length) return

      visualizationContainer.innerHTML = ""

      const maxSize = Math.max(...trendingTopics.map((item) => item.size))
      const containerWidth = visualizationContainer.offsetWidth
      const containerHeight = visualizationContainer.offsetHeight

      trendingTopics.forEach((item, index) => {
        const size = Math.max(30, Math.min(150, (item.size / maxSize) * 150)) * zoomLevel

        // Create bubble element
        const bubble = document.createElement("div")
        bubble.className = "absolute rounded-full flex items-center justify-center transition-all duration-300"
        bubble.setAttribute("data-index", index)
        bubble.setAttribute("title", `${item.name}: ${item.size}`)

        // Set position
        if (!bubblePositions[index]) {
          bubblePositions[index] = {
            x: Math.random() * (containerWidth - size),
            y: Math.random() * (containerHeight - size),
          }
        }

        // Apply styles
        bubble.style.width = `${size}px`
        bubble.style.height = `${size}px`
        bubble.style.left = `${bubblePositions[index].x}px`
        bubble.style.top = `${bubblePositions[index].y}px`
        bubble.style.backgroundColor = item.fill
        bubble.style.fontSize = `${Math.max(8, size / 8)}px`
        bubble.style.cursor = "grab"

        if (index === hoveredBubble || index === draggedBubble) {
          bubble.style.zIndex = "10"
          bubble.style.transform = "scale(1.1)"
        }

        if (index === draggedBubble) {
          bubble.style.cursor = "grabbing"
        }

        // Add label
        const label = document.createElement("span")
        label.className = "text-white font-medium px-1 text-center select-none"
        label.style.textShadow = "0px 0px 2px rgba(0,0,0,0.8)"
        label.style.maxWidth = "90%"
        label.style.overflow = "hidden"
        label.style.textOverflow = "ellipsis"
        label.style.whiteSpace = "nowrap"
        label.textContent = item.name
        bubble.appendChild(label)

        // Add event listeners
        bubble.addEventListener("mousedown", (e) => {
          e.preventDefault()
          draggedBubble = index
          isDragging = true
        })

        bubble.addEventListener("mouseenter", () => {
          hoveredBubble = index
          renderVisualization()
        })

        bubble.addEventListener("mouseleave", () => {
          hoveredBubble = null
          renderVisualization()
        })

        visualizationContainer.appendChild(bubble)
      })
    }

    function handleMouseMove(e) {
      if (isDragging && draggedBubble !== null) {
        const containerRect = visualizationContainer.getBoundingClientRect()
        const index = draggedBubble
        const item = trendingTopics[index]
        const maxSize = Math.max(...trendingTopics.map((item) => item.size))
        const size = Math.max(30, Math.min(150, (item.size / maxSize) * 150)) * zoomLevel

        // Calculate new position
        const newX = e.clientX - containerRect.left - size / 2
        const newY = e.clientY - containerRect.top - size / 2

        // Clamp to container bounds
        const clampedX = Math.max(0, Math.min(containerRect.width - size, newX))
        const clampedY = Math.max(0, Math.min(containerRect.height - size, newY))

        // Update position
        bubblePositions[index] = { x: clampedX, y: clampedY }

        // Update visualization
        renderVisualization()
      }
    }

    function handleMouseUp() {
      isDragging = false
      draggedBubble = null
    }

    // Set up polling to refresh data every 5 minutes
    setInterval(
      async () => {
        try {
          trendingTopics = await getTrendingTopics()
          renderVisualization()
        } catch (error) {
          console.error("Failed to refresh trending topics:", error)
        }
      },
      5 * 60 * 1000,
    )
  })

