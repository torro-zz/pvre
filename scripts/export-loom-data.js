const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/tmp/loom-community-voice.json', 'utf8'));

// Category definitions - same as user-feedback.tsx
const OPPORTUNITY_CATEGORIES = {
  pricing: {
    label: 'Pricing & Monetization',
    keywords: ['expensive', 'cost', 'pay', 'money', 'price', 'subscription', 'premium', 'free', 'purchase', 'buy', 'afford', 'worth', 'overpriced', 'cheap', 'fee', 'in-app', 'iap', 'microtransaction']
  },
  ads: {
    label: 'Ads & Interruptions',
    keywords: ['ad', 'ads', 'advertisement', 'commercial', 'banner', 'popup', 'pop-up', 'interrupt', 'annoying ad', 'too many ad', 'ad-free', 'remove ad']
  },
  content: {
    label: 'Content & Moderation',
    keywords: ['inappropriate', 'moderation', 'content', 'character', 'nsfw', 'adult', 'children', 'kid', 'safe', 'filter', 'report', 'offensive', 'toxic', 'harassment']
  },
  performance: {
    label: 'Performance & Bugs',
    keywords: ['crash', 'bug', 'slow', 'lag', 'freeze', 'glitch', 'error', 'broken', 'fix', 'issue', 'problem', 'stuck', 'load', 'loading', 'performance', 'battery', 'memory']
  },
  features: {
    label: 'Missing Features',
    keywords: ['wish', 'want', 'need', 'should', 'would be nice', 'please add', 'missing', 'lack', 'option', 'feature', 'setting', 'ability', 'could', 'hope']
  }
};

const CATEGORY_PRIORITY = ['pricing', 'performance', 'features', 'ads', 'content'];

// Categorize a signal - returns array of matching categories with counts
function categorizeSignal(signal) {
  const text = ((signal.text || '') + ' ' + (signal.title || '')).toLowerCase();
  const matches = [];

  for (const [category, config] of Object.entries(OPPORTUNITY_CATEGORIES)) {
    const matchCount = config.keywords.filter(keyword => text.includes(keyword)).length;
    if (matchCount > 0) {
      matches.push({ category, matchCount, label: config.label });
    }
  }

  // If solution-seeking, also add to features if not already there
  if (signal.solutionSeeking && !matches.some(m => m.category === 'features')) {
    matches.push({ category: 'features', matchCount: 1, label: OPPORTUNITY_CATEGORIES.features.label });
  }

  // Sort by match count (highest first), then by priority order
  return matches.sort((a, b) => {
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    return CATEGORY_PRIORITY.indexOf(a.category) - CATEGORY_PRIORITY.indexOf(b.category);
  });
}

let md = '# Loom: Screen Recorder - Full Research Export\n\n';
md += '**Research ID:** 15135c8d-870e-4dcc-9780-674a0b5ff55f\n';
md += '**Date:** January 2, 2026\n';
md += '**App Store Reviews Analyzed:** 500\n\n';

md += '---\n\n';
md += '## Summary Statistics\n\n';
md += '| Metric | Value |\n';
md += '|--------|-------|\n';
md += '| Total Pain Signals | ' + (data.painSignals?.length || 0) + ' |\n';
md += '| Core Signals | ' + (data.metadata?.filteringMetrics?.coreSignals || 0) + ' |\n';
md += '| Related Signals | ' + (data.metadata?.filteringMetrics?.relatedSignals || 0) + ' |\n';
md += '| Posts Analyzed | ' + (data.metadata?.filteringMetrics?.postsAnalyzed || 0) + ' |\n\n';

// Group signals by source
const appStoreSignals = (data.painSignals || []).filter(s => s.source?.subreddit === 'app_store' || s.source?.subreddit === 'google_play');
const redditSignals = (data.painSignals || []).filter(s => s.source?.subreddit && s.source.subreddit !== 'app_store' && s.source.subreddit !== 'google_play');

// Categorize all App Store signals
const categorizedByCategory = {
  pricing: [],
  ads: [],
  content: [],
  performance: [],
  features: [],
  uncategorized: []
};

appStoreSignals.forEach((signal, i) => {
  const categories = categorizeSignal(signal);
  const signalWithMeta = {
    ...signal,
    originalIndex: i + 1,
    primaryCategory: categories[0]?.label || 'Uncategorized',
    alsoIn: categories.slice(1).map(c => c.label)
  };

  if (categories.length > 0) {
    categorizedByCategory[categories[0].category].push(signalWithMeta);
  } else {
    categorizedByCategory.uncategorized.push(signalWithMeta);
  }
});

// Category counts summary
md += '## Category Breakdown (App Store Reviews)\n\n';
md += '| Category | Count |\n';
md += '|----------|-------|\n';
for (const cat of CATEGORY_PRIORITY) {
  md += '| ' + OPPORTUNITY_CATEGORIES[cat].label + ' | ' + categorizedByCategory[cat].length + ' |\n';
}
if (categorizedByCategory.uncategorized.length > 0) {
  md += '| Uncategorized | ' + categorizedByCategory.uncategorized.length + ' |\n';
}
md += '\n---\n\n';

// Output by category
for (const cat of CATEGORY_PRIORITY) {
  const signals = categorizedByCategory[cat];
  if (signals.length === 0) continue;

  md += '## ' + OPPORTUNITY_CATEGORIES[cat].label + ' (' + signals.length + ' reviews)\n\n';

  signals.forEach((signal, i) => {
    md += '### Review #' + signal.originalIndex + '\n\n';
    md += '- **Source:** ' + (signal.source?.subreddit || 'Unknown') + '\n';
    md += '- **Rating:** ' + (signal.rating ? '★'.repeat(signal.rating) + '☆'.repeat(5 - signal.rating) : (signal.source?.rating ? '★'.repeat(signal.source.rating) + '☆'.repeat(5 - signal.source.rating) : 'N/A')) + '\n';
    md += '- **Pain Intensity:** ' + (signal.painIntensity || 'N/A') + '\n';
    md += '- **WTP Confidence:** ' + (signal.wtpConfidence || 'none') + '\n';
    md += '- **Primary Category:** ' + signal.primaryCategory + '\n';
    if (signal.alsoIn.length > 0) {
      md += '- **Also In:** ' + signal.alsoIn.join(', ') + '\n';
    }
    md += '- **Link:** ' + (signal.source?.url || 'N/A') + '\n\n';
    md += '**Full Text:**\n';
    md += '> ' + (signal.text || '').replace(/\n/g, '\n> ') + '\n\n';
    md += '---\n\n';
  });
}

// Uncategorized signals
if (categorizedByCategory.uncategorized.length > 0) {
  md += '## Uncategorized (' + categorizedByCategory.uncategorized.length + ' reviews)\n\n';
  categorizedByCategory.uncategorized.forEach((signal, i) => {
    md += '### Review #' + signal.originalIndex + '\n\n';
    md += '- **Source:** ' + (signal.source?.subreddit || 'Unknown') + '\n';
    md += '- **Rating:** ' + (signal.source?.rating ? '★'.repeat(signal.source.rating) + '☆'.repeat(5 - signal.source.rating) : 'N/A') + '\n';
    md += '- **Pain Intensity:** ' + (signal.painIntensity || 'N/A') + '\n';
    md += '- **Full Text:**\n';
    md += '> ' + (signal.text || '').replace(/\n/g, '\n> ') + '\n\n';
    md += '---\n\n';
  });
}

// Reddit signals section
md += '## Reddit Discussions (' + redditSignals.length + ' signals)\n\n';

redditSignals.forEach((signal, i) => {
  md += '### Post ' + (i + 1) + '\n\n';
  md += '- **Subreddit:** r/' + (signal.source?.subreddit || 'Unknown') + '\n';
  md += '- **Pain Intensity:** ' + (signal.painIntensity || 'N/A') + '\n';
  md += '- **WTP Confidence:** ' + (signal.wtpConfidence || 'none') + '\n';
  md += '- **Link:** ' + (signal.source?.url || 'N/A') + '\n\n';
  if (signal.title) {
    md += '**Title:** ' + signal.title + '\n\n';
  }
  md += '**Full Text:**\n';
  md += '> ' + (signal.text || '').replace(/\n/g, '\n> ') + '\n\n';
  md += '---\n\n';
});

// Add theme analysis if available
if (data.themeAnalysis?.themes?.length > 0) {
  md += '## Theme Analysis\n\n';
  data.themeAnalysis.themes.forEach((theme, i) => {
    md += '### Theme ' + (i + 1) + ': ' + theme.name + '\n\n';
    md += '- **Signal Count:** ' + theme.signalCount + '\n';
    md += '- **Pain Intensity:** ' + theme.painIntensity + '\n';
    md += '- **WTP Confidence:** ' + theme.wtpConfidence + '\n\n';
    md += '**Description:** ' + theme.description + '\n\n';
    if (theme.quotes?.length > 0) {
      md += '**Supporting Quotes:**\n\n';
      theme.quotes.forEach(q => {
        md += '> "' + q.text + '"\n';
        md += '> - Source: ' + q.source + '\n\n';
      });
    }
    md += '---\n\n';
  });
}

fs.writeFileSync('docs/exports/loom-500-reviews-export.md', md);
console.log('Exported to docs/exports/loom-500-reviews-export.md');
console.log('App Store signals:', appStoreSignals.length);
console.log('Reddit signals:', redditSignals.length);
console.log('\nCategory breakdown:');
for (const cat of CATEGORY_PRIORITY) {
  console.log('  ' + OPPORTUNITY_CATEGORIES[cat].label + ':', categorizedByCategory[cat].length);
}
if (categorizedByCategory.uncategorized.length > 0) {
  console.log('  Uncategorized:', categorizedByCategory.uncategorized.length);
}
