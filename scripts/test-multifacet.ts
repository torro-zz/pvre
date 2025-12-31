import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { generateMultiFacetEmbeddings, isEmbeddingServiceAvailable } from '../src/lib/embeddings';

async function main() {
  console.log('Embedding service available:', isEmbeddingServiceAvailable());

  const result = await generateMultiFacetEmbeddings('Freelancers struggling to get paid on time');

  if (result) {
    console.log('SUCCESS! Generated', result.embeddings.length, 'facet embeddings');
    console.log('Facets:', result.facets.map(f => f.slice(0, 50) + '...'));
    console.log('Embedding lengths:', result.embeddings.map(e => e.length));
  } else {
    console.log('FAILED: generateMultiFacetEmbeddings returned null');
  }
}

main().catch(console.error);
