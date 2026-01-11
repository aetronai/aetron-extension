// Content Script - bridges page and extension
// This script runs in the context of web pages and forwards messages to background

// Inject the provider script into the page
function injectProvider() {
  const script = document.createElement('script')
  script.src = chrome.runtime.getURL('injected.js')
  script.onload = () => {
    script.remove()
  }
  ;(document.head || document.documentElement).appendChild(script)
}

// Inject immediately
injectProvider()

// Create connection to background script
const port = chrome.runtime.connect({ name: 'aetron-content' })

// Request ID counter for matching responses
let requestId = 0
const pendingRequests = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>()

// Listen for messages from injected script (via window.postMessage)
window.addEventListener('message', (event) => {
  // Only accept messages from same window
  if (event.source !== window) return

  // Only accept AETRON messages
  if (event.data?.type !== 'AETRON_REQUEST') return

  const { id, method, params } = event.data.payload

  // Forward to background
  port.postMessage({
    id,
    origin: window.location.origin,
    method,
    params,
  })
})

// Listen for responses from background
port.onMessage.addListener((message) => {
  if (message.type === 'AETRON_RESPONSE') {
    // Forward back to page
    window.postMessage(
      {
        type: 'AETRON_RESPONSE',
        id: message.id,
        result: message.result,
        error: message.error,
      },
      '*'
    )
  }

  // Handle events from background (account changes, network changes, etc.)
  if (message.type === 'AETRON_EVENT') {
    window.postMessage(
      {
        type: 'AETRON_EVENT',
        event: message.event,
        data: message.data,
      },
      '*'
    )
  }
})

// Handle disconnect
port.onDisconnect.addListener(() => {
  console.log('AETRON: Disconnected from background')
})

// Notify page that content script is ready
window.postMessage({ type: 'AETRON_CONTENT_READY' }, '*')

console.log('AETRON Wallet content script loaded')
