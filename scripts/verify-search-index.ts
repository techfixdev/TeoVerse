import { listSearchDocuments } from '../src/db/queries';

async function verifySearchIndex() {
  const documents = await listSearchDocuments();

  if (documents.length < 30_000) {
    throw new Error(`Expected complete spapddpt search documents to include more than 30000 verses, got ${documents.length}.`);
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

  const johnThreeSixteen = documents.find(
    (document) =>
      document.version === 'spapddpt' && document.book === 'Juan' && document.chapter === 3 && document.verse === 16,
  );

  if (!johnThreeSixteen?.text || !/Dios/i.test(johnThreeSixteen.text)) {
    throw new Error('Expected search documents to include Juan 3:16 from complete spapddpt data.');
  }

  if (johnThreeSixteen.href !== '/biblia/spapddpt/juan/3/#v16') {
    throw new Error(`Expected Juan 3:16 href to target the verse anchor, got ${johnThreeSixteen.href}.`);
  }
}

verifySearchIndex().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
