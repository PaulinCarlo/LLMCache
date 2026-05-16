(function (root, factory) {
  const api = factory()
  if (typeof module === "object" && module.exports) {
    module.exports = api
  }
  root.PromptCacheApi = api
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function toObject(value) {
    return value && typeof value === "object" ? value : {}
  }

  async function resolveAuthHeaders(getAuthHeaders) {
    if (!getAuthHeaders) return {}
    const headers = await getAuthHeaders()
    return toObject(headers)
  }

  function hasJsonResponse(response) {
    const contentType = response.headers.get("content-type") || ""
    return contentType.includes("application/json")
  }

  function normalizeSnippetList(data) {
    if (Array.isArray(data)) {
      if (data.length > 0 && data[0] && typeof data[0] === "object" && "snippet" in data[0]) {
        return data.map((item) => item.snippet).filter(Boolean)
      }
      return data
    }
    if (data && Array.isArray(data.items)) {
      return data.items
    }
    return []
  }

  async function requestJson(client, path, options) {
    const opts = options || {}
    const method = opts.method || "GET"
    const authHeaders = await resolveAuthHeaders(client.getAuthHeaders)
    const headers = { ...toObject(opts.headers), ...authHeaders }
    const hasBody = opts.body !== undefined
    if (hasBody) headers["Content-Type"] = "application/json"

    const response = await fetch(`${client.baseUrl}${path}`, {
      method,
      headers,
      body: hasBody ? JSON.stringify(opts.body) : undefined
    })

    const data = hasJsonResponse(response) ? await response.json() : null
    return { ok: response.ok, status: response.status, data }
  }

  function createClient(config) {
    const client = {
      baseUrl: config?.baseUrl || "",
      getAuthHeaders: config?.getAuthHeaders
    }

    return {
      listSnippets: async function (opts) {
        const query = opts?.query?.trim() || ""
        const topK = opts?.topK ?? 20
        const minSimilarity = opts?.minSimilarity ?? 0.3
        const pageSize = opts?.pageSize ?? 100
        const path = query
          ? `/api/snippets/search?prompt=${encodeURIComponent(query)}&topK=${topK}&minSimilarity=${minSimilarity}`
          : `/api/snippets?pageSize=${pageSize}`
        const result = await requestJson(client, path)
        return { ...result, snippets: normalizeSnippetList(result.data) }
      },

      searchSnippets: async function (opts) {
        const prompt = opts?.prompt || ""
        const topK = opts?.topK ?? 3
        const minSimilarity = opts?.minSimilarity ?? 0.65
        const path = `/api/snippets/search?prompt=${encodeURIComponent(prompt)}&topK=${topK}&minSimilarity=${minSimilarity}`
        const result = await requestJson(client, path)
        return { ...result, results: Array.isArray(result.data) ? result.data : [] }
      },

      createSnippet: async function (payload) {
        return requestJson(client, "/api/snippets", { method: "POST", body: payload })
      },

      deleteSnippet: async function (snippetId) {
        return requestJson(client, `/api/snippets/${encodeURIComponent(snippetId)}`, { method: "DELETE" })
      },

      computeDelta: async function (payload) {
        return requestJson(client, "/api/delta", { method: "POST", body: payload })
      },

      login: async function (payload) {
        return requestJson(client, "/api/auth/login", { method: "POST", body: payload })
      },

      register: async function (payload) {
        return requestJson(client, "/api/auth/register", { method: "POST", body: payload })
      },

      buildExternalLoginUrl: function (provider, returnUrl) {
        return `${client.baseUrl}/api/auth/external-login?provider=${encodeURIComponent(provider)}&returnUrl=${encodeURIComponent(returnUrl)}`
      }
    }
  }

  return { createClient, normalizeSnippetList }
})
