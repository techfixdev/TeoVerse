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

  if (paths.length < 1_000) {
    throw new Error(`Expected complete spapddpt static paths to include more than 1000 chapters, got ${paths.length}.`);
  }

  const johnThreePath = paths.find(
    (path) => path.version === 'spapddpt' && path.libro === 'juan' && path.capitulo === '3',
  );

  if (!johnThreePath) {
    throw new Error('Expected static paths to include /biblia/spapddpt/juan/3.');
  }

  const matthewSixPath = paths.find(
    (path) => path.version === 'spapddpt' && path.libro === 'mateo' && path.capitulo === '6',
  );

  if (!matthewSixPath) {
    throw new Error('Expected static paths to include /biblia/spapddpt/mateo/6.');
  }

  if (chapter.versiculos.length < 30) {
    throw new Error(`Expected complete Genesis 1 to include at least 30 verses, got ${chapter.versiculos.length}.`);
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

  if (navigation.next?.href !== '/biblia/spapddpt/genesis/2/') {
    throw new Error(`Expected Genesis 1 next link to target Genesis 2, got ${navigation.next?.href ?? 'null'}.`);
  }

  const johnThree = await getChapter({ version: 'spapddpt', libro: 'juan', capitulo: 3 });

  if (!johnThree) {
    throw new Error('Expected getChapter to return Juan 3 for spapddpt.');
  }

  const johnThreeSixteen = johnThree.versiculos.find((verse) => verse.numero === 16);

  if (!johnThreeSixteen?.texto) {
    throw new Error('Expected Juan 3:16 to exist in imported spapddpt data.');
  }

  if (!/Dios/i.test(johnThreeSixteen.texto)) {
    throw new Error(`Expected Juan 3:16 text to mention Dios, got: ${johnThreeSixteen.texto}`);
  }

  const matthewSix = await getChapter({ version: 'spapddpt', libro: 'mateo', capitulo: 6 });

  if (!matthewSix?.versiculos.some((verse) => verse.numero === 33 && /reino/i.test(verse.texto))) {
    throw new Error('Expected Mateo 6:33 to exist and mention reino in imported spapddpt data.');
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

  if (spapddptLibrary.books.length !== 66) {
    throw new Error(`Expected spapddpt library to include 66 books, got ${spapddptLibrary.books.length}.`);
  }

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

  if (!genesisLibrary.chapters.some((chapterLink) => chapterLink.capitulo === 50)) {
    throw new Error('Expected Genesis library entry to include chapter 50.');
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
