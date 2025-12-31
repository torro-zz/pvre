// Test word boundary matching
function getStemVariants(word: string): string[] {
  const variants = [word]
  if (word.endsWith('s') && word.length > 3) {
    variants.push(word.slice(0, -1))
  } else {
    variants.push(word + 's')
  }
  return variants
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function containsWithStemming(text: string, word: string): boolean {
  const variants = getStemVariants(word)
  return variants.some(v => {
    const regex = new RegExp(`\\b${escapeRegex(v)}\\b`, 'i')
    return regex.test(text)
  })
}

console.log('=== WORD BOUNDARY TEST ===')
console.log('')
console.log('Test: "deflated" should NOT match "late"')
console.log('Result:', containsWithStemming('deflated', 'late') ? 'FAILED (still matches)' : 'PASSED (no match)')
console.log('')
console.log('Test: "late payment" should match "late"')
console.log('Result:', containsWithStemming('late payment', 'late') ? 'PASSED (matches)' : 'FAILED (no match)')
console.log('')
console.log('Test: "payments" should match "payment"')
console.log('Result:', containsWithStemming('payments nightmare', 'payment') ? 'PASSED (matches)' : 'FAILED (no match)')
console.log('')
console.log('Test: "isolated" should NOT match "late"')
console.log('Result:', containsWithStemming('isolated business', 'late') ? 'FAILED (matches)' : 'PASSED (no match)')
console.log('')
console.log('Test: "Nonpayment" should match "payment"')
console.log('Result:', containsWithStemming('Nonpayment issue', 'payment') ? 'PASSED (matches)' : 'FAILED (no match)')
console.log('')
console.log("Test: \"can't get\" phrase is NOT in list anymore")
console.log('(Removed overly broad phrases)')
console.log('')
console.log('=== NONPAYMENT TITLE TEST ===')
const nonpaymentTitle = "We Lost $120k to Client Nonpayment: our story"
console.log("Title:", nonpaymentTitle)
console.log('')
console.log("Testing keywords:")
const testWords = ['lost', 'lose', 'client', 'payment']
for (const word of testWords) {
  console.log(`  "${word}":`, containsWithStemming(nonpaymentTitle.toLowerCase(), word) ? 'MATCH' : 'no match')
}
