import { faker } from "@faker-js/faker";
import { SharedError } from "@shared/domain/errors/shared.error";
import { describe, expect, it } from "vitest";

import { expectAppError } from "./expect-app-error";
import { InMemoryRepository } from "./in-memory-repository";

type NoteSnapshot = {
  id: string;
  text: string;
  version: number;
  createdAt: Date;
};

class Note {
  constructor(private state: NoteSnapshot) {}

  static create(
    createdAt = faker.date.past(),
    id = faker.database.mongodbObjectId(),
  ) {
    return new Note({
      id,
      text: faker.lorem.sentence(),
      version: 0,
      createdAt,
    });
  }

  set text(text: string) {
    this.state.text = text;
  }

  markAsSaved() {
    this.state.version += 1;
  }

  toSnapshot(): NoteSnapshot {
    return { ...this.state };
  }
}

class InMemoryNoteRepository extends InMemoryRepository<{
  entity: Note;
  snapshot: NoteSnapshot;
}> {
  protected toSnapshot(note: Note) {
    return note.toSnapshot();
  }

  protected restore(snapshot: NoteSnapshot) {
    return new Note({ ...snapshot });
  }

  save(note: Note) {
    return this.store(note);
  }

  findById(id: string) {
    const snapshot = this.snapshots.get(id);
    return Promise.resolve(snapshot ? this.restore(snapshot) : null);
  }

  list() {
    return Promise.resolve(this.inCreationOrder([...this.snapshots.values()]));
  }
}

describe("InMemoryRepository", () => {
  it("stores a new entity at version 1 and moves the entity to it", async () => {
    const notes = new InMemoryNoteRepository();
    const note = Note.create();

    await notes.save(note);

    const found = await notes.findById(note.toSnapshot().id);
    expect(found?.toSnapshot()).toStrictEqual(note.toSnapshot());
    expect(note.toSnapshot().version).toBe(1);
  });

  it("does not expose changes that were never saved", async () => {
    const notes = new InMemoryNoteRepository();
    const note = Note.create();
    await notes.save(note);
    const { text } = note.toSnapshot();

    note.text = faker.lorem.sentence();

    expect(
      (await notes.findById(note.toSnapshot().id))?.toSnapshot().text,
    ).toBe(text);
  });

  it("refuses a second new entity with an id already stored", async () => {
    const notes = new InMemoryNoteRepository();
    const note = Note.create();
    await notes.save(note);

    await expectAppError(
      notes.save(Note.create(undefined, note.toSnapshot().id)),
      SharedError.AlreadyExists,
      { id: note.toSnapshot().id },
    );
  });

  it("refuses a save from a version that is no longer stored", async () => {
    const notes = new InMemoryNoteRepository();
    const note = Note.create();
    await notes.save(note);
    const { id } = note.toSnapshot();
    const first = (await notes.findById(id)) as Note;
    const second = (await notes.findById(id)) as Note;
    await notes.save(first);

    await expectAppError(notes.save(second), SharedError.VersionConflict, {
      id,
      version: 1,
    });
  });

  it("refuses a save of an entity that was never stored", async () => {
    const notes = new InMemoryNoteRepository();
    const note = Note.create();
    note.markAsSaved();

    await expectAppError(notes.save(note), SharedError.VersionConflict, {
      id: note.toSnapshot().id,
      version: 1,
    });
  });

  it("lists in creation order, then by id", async () => {
    const notes = new InMemoryNoteRepository();
    const createdAt = faker.date.past();
    const later = Note.create(new Date(createdAt.getTime() + 1_000));
    const [firstId, secondId] = [
      faker.database.mongodbObjectId(),
      faker.database.mongodbObjectId(),
    ].sort();
    const second = Note.create(createdAt, secondId);
    const first = Note.create(createdAt, firstId);
    await notes.save(later);
    await notes.save(second);
    await notes.save(first);

    const listed = await notes.list();

    expect(listed.map((note) => note.toSnapshot().id)).toStrictEqual([
      firstId,
      secondId,
      later.toSnapshot().id,
    ]);
  });
});
