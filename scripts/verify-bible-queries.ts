import { getChapter, getHomeChapter, listBibleAttributions, listStaticChapterPaths } from '../src/db/queries';

async function verifyBibleQueries() {
  const paths = await listStaticChapterPaths();
  const genesisPath = paths.find(
    (path) => path.version === 'spapddpt' && path.libro === 'genesis' && path.capitulo === '1',
  );

  if (!genesisPath) {
    throw new Error('Expected static paths to include /biblia/spapddpt/genesis/1.');
  }

  const chapter = await getChapter({ version: 'spapddpt', libro: 'genesis', capitulo: 1 });

  if (!chapter) {
    throw new Error('Expected getChapter to return Genesis 1 for spapddpt.');
  }

  if (chapter.biblia.slug !== 'spapddpt') {
    throw new Error(`Expected Biblia slug spapddpt, got ${chapter.biblia.slug}.`);
  }

  if (chapter.libro.slug !== 'genesis') {
    throw new Error(`Expected book slug genesis, got ${chapter.libro.slug}.`);
  }

  if (chapter.versiculos.length !== 5) {
    throw new Error(`Expected 5 seeded verses, got ${chapter.versiculos.length}.`);
  }

  if (chapter.versiculos[0]?.texto !== 'En un principio ʼElohim creó los cielos y la tierra.') {
    throw new Error('Expected Genesis 1:1 seeded text to come from the database.');
  }

  const homeChapter = await getHomeChapter();

  if (!homeChapter) {
    throw new Error('Expected getHomeChapter to return the seeded home chapter.');
  }

  if (homeChapter.biblia.slug !== 'spapddpt' || homeChapter.libro.slug !== 'genesis' || homeChapter.capitulo !== 1) {
    throw new Error('Expected getHomeChapter to resolve spapddpt Genesis 1.');
  }

  if (homeChapter.versiculos[0]?.texto !== chapter.versiculos[0]?.texto) {
    throw new Error('Expected home chapter text to come from the same DB-backed chapter query.');
  }

  const attributions = await listBibleAttributions();
  const spapddptAttribution = attributions.find((attribution) => attribution.slug === 'spapddpt');

  if (!spapddptAttribution) {
    throw new Error('Expected listBibleAttributions to include spapddpt.');
  }

  if (!spapddptAttribution.licencia.includes('CC BY 4.0')) {
    throw new Error('Expected spapddpt attribution to expose CC BY 4.0 license metadata.');
  }

  if (!spapddptAttribution.fuente.includes('https://ebible.org/find/details.php?id=spapddpt')) {
    throw new Error('Expected spapddpt attribution to expose its eBible.org source link.');
  }
}

verifyBibleQueries().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
