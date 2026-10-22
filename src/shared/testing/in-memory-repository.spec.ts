import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { InMemoryRepository } from "./in-memory-repository";

type NoteSnapshot = { id: string; text: string };

class Note {
  constructor(
    readonly id: string,
    public text: string,
  ) {}

  static restore(snapshot: NoteSnapshot): Note {
    return new Note(snapshot.id, snapshot.text);
  }

  toSnapshot(): NoteSnapshot {
    return { id: this.id, text: this.text };
  }
}

/** Implements only save and findById. */
class InMemoryNoteRepository extends InMemoryRepository<{
  entity: Note;
  snapshot: NoteSnapshot;
}> {
  protected toSnapshot(note: Note) {
    return note.toSnapshot();
  }

  protected restore(snapshot: NoteSnapshot) {
    return Note.restore(snapshot);
  }

  save(note: Note) {
    const snapshot = this.toSnapshot(note);
    this.snapshots.set(snapshot.id, snapshot);
    return Promise.resolve();
  }

  findById(id: string) {
    const snapshot = this.snapshots.get(id);
    return Promise.resolve(snapshot ? this.restore(snapshot) : null);
  }
}

describe("InMemoryRepository", () => {
  it("lets a repository store and read snapshots", async () => {
    const notes = new InMemoryNoteRepository();
    const id = faker.database.mongodbObjectId();
    const text = faker.lorem.sentence();
    await notes.save(new Note(id, text));

    const found = await notes.findById(id);

    expect(found?.toSnapshot()).toEqual({ id, text });
  });

  it("does not expose changes that were never saved", async () => {
    const notes = new InMemoryNoteRepository();
    const text = faker.lorem.sentence();
    const note = new Note(faker.database.mongodbObjectId(), text);
    await notes.save(note);

    note.text = `${text} (edited)`;

    expect((await notes.findById(note.id))?.text).toBe(text);
  });
});
