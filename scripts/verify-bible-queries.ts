import {
  getChapter,
  getChapterNavigation,
  getHomeChapter,
  listBibleLibrary,
  listBibleAttributions,
  listStaticChapterPaths,
} from '../src/db/queries';

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

  const navigation = await getChapterNavigation({ version: 'spapddpt', libro: 'genesis', capitulo: 1 });

  if (!navigation) {
    throw new Error('Expected getChapterNavigation to return navigation metadata for Genesis 1.');
  }

  if (navigation.current.href !== '/biblia/spapddpt/genesis/1/') {
    throw new Error(`Expected current chapter href /biblia/spapddpt/genesis/1/, got ${navigation.current.href}.`);
  }

  if (navigation.current.label !== 'Génesis 1') {
    throw new Error(`Expected current chapter label Génesis 1, got ${navigation.current.label}.`);
  }

  if (navigation.previous !== null) {
    throw new Error('Expected seeded Genesis 1 to have no previous chapter navigation link.');
  }

  if (navigation.next !== null) {
    throw new Error('Expected seeded Genesis 1 to have no next chapter navigation link.');
  }

  const library = await listBibleLibrary();
  const spapddptLibrary = library.find((version) => version.slug === 'spapddpt');

  if (!spapddptLibrary) {
    throw new Error('Expected listBibleLibrary to include spapddpt.');
  }

  if (spapddptLibrary.nombre !== 'Palabra de Dios para ti') {
    throw new Error(`Expected spapddpt library name Palabra de Dios para ti, got ${spapddptLibrary.nombre}.`);
  }

  const genesisLibrary = spapddptLibrary.books.find((book) => book.slug === 'genesis');

  if (!genesisLibrary) {
    throw new Error('Expected spapddpt library to include Genesis.');
  }

  if (genesisLibrary.nombre !== 'Génesis') {
    throw new Error(`Expected Genesis library name Génesis, got ${genesisLibrary.nombre}.`);
  }

  const genesisChapter = genesisLibrary.chapters.find((chapterLink) => chapterLink.capitulo === 1);

  if (!genesisChapter) {
    throw new Error('Expected Genesis library entry to include chapter 1.');
  }

  if (genesisChapter.href !== '/biblia/spapddpt/genesis/1/') {
    throw new Error(`Expected Genesis 1 library href /biblia/spapddpt/genesis/1/, got ${genesisChapter.href}.`);
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
