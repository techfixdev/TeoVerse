import { listSearchDocuments } from '../src/db/queries';

async function verifySearchIndex() {
  const documents = await listSearchDocuments();

  if (documents.length !== 5) {
    throw new Error(`Expected 5 seeded search documents, got ${documents.length}.`);
  }

  const genesisOneOne = documents.find(
    (document) =>
      document.version === 'spapddpt' &&
      document.book === 'Génesis' &&
      document.chapter === 1 &&
      document.verse === 1,
  );

  if (!genesisOneOne) {
    throw new Error('Expected search documents to include spapddpt Genesis 1:1.');
  }

  if (genesisOneOne.text !== 'En un principio ʼElohim creó los cielos y la tierra.') {
    throw new Error('Expected Genesis 1:1 search text to come from the seeded database.');
  }

  if (genesisOneOne.href !== '/biblia/spapddpt/genesis/1/#v1') {
    throw new Error(`Expected Genesis 1:1 href to target the verse anchor, got ${genesisOneOne.href}.`);
  }

  const invalidDocument = documents.find(
    (document) =>
      document.version !== 'spapddpt' || document.book !== 'Génesis' || document.chapter !== 1 || !document.href,
  );

  if (invalidDocument) {
    throw new Error('Expected the MVP search index to contain only safe seeded spapddpt Genesis 1 documents.');
  }
}

verifySearchIndex().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
