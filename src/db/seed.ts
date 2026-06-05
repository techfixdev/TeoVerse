import { eq } from 'drizzle-orm';
import { db } from './client';
import { recursos, libros, recursoLibros, versiculos, diccionarioEntradas } from './schema';

async function seed() {
  const [createdRecurso] = await db
    .insert(recursos)
    .values({
      tipo: 'biblia',
      slug: 'spapddpt',
      nombre: 'Palabra de Dios para ti',
      idioma: 'es',
      licencia: 'Creative Commons Attribution 4.0 International (CC BY 4.0)',
      fuente: 'eBible.org — https://ebible.org/find/details.php?id=spapddpt',
    })
    .onConflictDoNothing()
    .returning();

  const recurso =
    createdRecurso ??
    (await db.select().from(recursos).where(eq(recursos.slug, 'spapddpt')).get());
  if (!recurso) throw new Error('No se pudo crear ni recuperar el recurso spapddpt.');

  const [createdGenesis] = await db
    .insert(libros)
    .values({ testamento: 'AT', nombre: 'Génesis', slug: 'genesis', abreviatura: 'Gn' })
    .onConflictDoNothing()
    .returning();

  const genesis =
    createdGenesis ?? (await db.select().from(libros).where(eq(libros.slug, 'genesis')).get());
  if (!genesis) throw new Error('No se pudo crear ni recuperar el libro Génesis.');

  await db
    .insert(recursoLibros)
    .values({ recursoId: recurso.id, libroId: genesis.id, orden: 1 })
    .onConflictDoNothing();

  await db
    .insert(versiculos)
    .values([
      {
        recursoId: recurso.id,
        libroId: genesis.id,
        capitulo: 1,
        versiculo: 1,
        texto: 'En un principio ʼElohim creó los cielos y la tierra.',
      },
      {
        recursoId: recurso.id,
        libroId: genesis.id,
        capitulo: 1,
        versiculo: 2,
        texto: 'La tierra estaba desordenada y vacía, y las tinieblas estaban sobre la superficie del abismo. El Espíritu de ʼElohim se movía sobre la superficie de las aguas.',
      },
      {
        recursoId: recurso.id,
        libroId: genesis.id,
        capitulo: 1,
        versiculo: 3,
        texto: 'Entonces ʼElohim dijo: Haya luz. Y hubo luz.',
      },
      {
        recursoId: recurso.id,
        libroId: genesis.id,
        capitulo: 1,
        versiculo: 4,
        texto: 'ʼElohim vio que la luz era buena, y ʼElohim separó la luz de las tinieblas.',
      },
      {
        recursoId: recurso.id,
        libroId: genesis.id,
        capitulo: 1,
        versiculo: 5,
        texto: 'ʼElohim llamó a la luz Día, y a las tinieblas llamó Noche. Y fue la tarde y fue la mañana: día uno.',
      },
    ])
    .onConflictDoNothing();

  // Seed lexicon recurso for the Strong dictionary
  const [createdLexicon] = await db
    .insert(recursos)
    .values({
      tipo: 'diccionario',
      slug: 'strong-es',
      nombre: 'Strong Español',
      idioma: 'es',
      licencia: 'Public Domain',
      fuente: 'Strong Concordance — dominio público',
    })
    .onConflictDoNothing()
    .returning();

  const lexicon =
    createdLexicon ??
    (await db.select().from(recursos).where(eq(recursos.slug, 'strong-es')).get());
  if (!lexicon) throw new Error('No se pudo crear ni recuperar el recurso lexicon strong-es.');

  await db
    .insert(diccionarioEntradas)
    .values([
      {
        recursoId: lexicon.id,
        codigoStrong: 'H7225',
        lema: 'principio',
        definicion: 'Comienzo, primero o punto de origen.',
      },
      {
        recursoId: lexicon.id,
        codigoStrong: 'H430',
        lema: 'Dios',
        definicion: 'Elohim; término hebreo usado para Dios en Génesis.',
      },
    ])
    .onConflictDoNothing();

  console.info('Seed spapddpt completado correctamente.');
}

seed().catch((error) => {
  console.error('Error ejecutando seed:', error);
  process.exitCode = 1;
});
