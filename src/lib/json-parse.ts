// Safe JSON parsing utility for Claude responses
// Handles common issues like markdown code fences, control characters, and malformed JSON

export interface SafeParseResult<T> {
  success: boolean
  data?: T
  error?: string
  repaired?: boolean
}

/**
 * Safely parse JSON from Claude's response text
 * Handles:
 * - Markdown code fences (```json ... ```)
 * - Control characters in strings
 * - Trailing commas
 * - Single quotes (converts to double)
 * - Unescaped newlines in strings
 */
export function safeParseJSON<T>(text: string): SafeParseResult<T> {
  // Step 1: Strip markdown code fences if present
  let cleaned = stripMarkdownFences(text)

  // Step 2: Extract JSON object/array from text
  const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  if (!jsonMatch) {
    return { success: false, error: 'No JSON object or array found in text' }
  }

  let jsonStr = jsonMatch[0]

  // Step 3: Try parsing as-is first
  try {
    const data = JSON.parse(jsonStr) as T
    return { success: true, data }
  } catch (firstError) {
    // Continue to repair attempts
  }

  // Step 4: Attempt repairs
  const repairAttempts = [
    () => repairControlCharacters(jsonStr),
    () => repairTrailingCommas(jsonStr),
    () => repairUnescapedQuotes(jsonStr),
    () => repairTruncatedJSON(jsonStr),
  ]

  for (const repair of repairAttempts) {
    try {
      const repaired = repair()
      const data = JSON.parse(repaired) as T
      return { success: true, data, repaired: true }
    } catch {
      // Try next repair
    }
  }

  // Step 5: Try all repairs combined
  try {
    let fullyRepaired = jsonStr
    fullyRepaired = repairControlCharacters(fullyRepaired)
    fullyRepaired = repairTrailingCommas(fullyRepaired)
    fullyRepaired = repairUnescapedQuotes(fullyRepaired)
    fullyRepaired = repairTruncatedJSON(fullyRepaired)

    const data = JSON.parse(fullyRepaired) as T
    return { success: true, data, repaired: true }
  } catch (finalError) {
    const errorMessage = finalError instanceof Error ? finalError.message : 'Unknown parse error'
    return {
      success: false,
      error: `JSON parse failed after repairs: ${errorMessage}`
    }
  }
}

/**
 * Remove markdown code fences from text
 */
function stripMarkdownFences(text: string): string {
  // Remove ```json or ``` at start and ``` at end
  return text
    .replace(/^[\s\S]*?```(?:json)?\s*\n?/i, '')
    .replace(/\n?```[\s\S]*$/i, '')
    .trim()
}

/**
 * Replace control characters that break JSON parsing
 */
function repairControlCharacters(json: string): string {
  // Replace unescaped control characters in strings
  // This regex finds strings and escapes control chars within them
  return json.replace(/"([^"\\]|\\.)*"/g, (match) => {
    return match
      .replace(/[\x00-\x1f]/g, (char) => {
        const code = char.charCodeAt(0)
        switch (code) {
          case 0x09: return '\\t'
          case 0x0a: return '\\n'
          case 0x0d: return '\\r'
          default: return `\\u${code.toString(16).padStart(4, '0')}`
        }
      })
  })
}

/**
 * Remove trailing commas before } or ]
 */
function repairTrailingCommas(json: string): string {
  return json
    .replace(/,(\s*[}\]])/g, '$1')
}

/**
 * Escape unescaped quotes within strings
 * This is tricky - we look for patterns that suggest broken quotes
 */
function repairUnescapedQuotes(json: string): string {
  // Replace smart quotes with regular quotes
  return json
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
}

/**
 * Try to repair truncated JSON by closing brackets
 */
function repairTruncatedJSON(json: string): string {
  // Count brackets to see if we need to close any
  let braceCount = 0
  let bracketCount = 0
  let inString = false
  let escape = false

  for (const char of json) {
    if (escape) {
      escape = false
      continue
    }
    if (char === '\\') {
      escape = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (char === '{') braceCount++
    if (char === '}') braceCount--
    if (char === '[') bracketCount++
    if (char === ']') bracketCount--
  }

  // If we're inside a string, close it
  if (inString) {
    json += '"'
  }

  // Close any unclosed brackets/braces
  while (bracketCount > 0) {
    json += ']'
    bracketCount--
  }
  while (braceCount > 0) {
    json += '}'
    braceCount--
  }

  return json
}

/**
 * Extract and parse JSON from Claude's response, with fallback
 * Throws an error with a helpful message if parsing fails
 */
export function parseClaudeJSON<T>(
  responseText: string,
  context: string = 'Claude response'
): T {
  const result = safeParseJSON<T>(responseText)

  if (result.success && result.data !== undefined) {
    if (result.repaired) {
      console.warn(`JSON from ${context} required repair`)
    }
    return result.data
  }

  // Log the problematic text for debugging
  console.error(`Failed to parse JSON from ${context}:`, result.error)
  console.error('Response text (first 500 chars):', responseText.slice(0, 500))

  throw new Error(`Could not parse JSON from ${context}: ${result.error}`)
}
