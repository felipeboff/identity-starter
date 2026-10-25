import { AppError } from "@shared/domain/errors/app-error";
import { SharedError } from "@shared/domain/errors/shared.error";
import type { Model, Types, UpdateQuery } from "mongoose";

import { isDuplicateKey } from "./duplicate-key";

export type VersionedDocument = Readonly<{
  _id: Types.ObjectId;
  version: number;
}>;

export class OptimisticWriter<TDocument extends VersionedDocument> {
  constructor(private readonly model: Model<TDocument>) {}

  async save(document: TDocument): Promise<void> {
    const { _id, version, ...fields } = document;
    if (version === 0) {
      await this.create(document);
      return;
    }

    const result = await this.model.updateOne(
      { _id, version },
      {
        $set: fields as UpdateQuery<TDocument>["$set"],
        $inc: { version: 1 },
      },
      { runValidators: true },
    );
    if (result.matchedCount === 0) {
      throw new AppError(SharedError.VersionConflict, {
        id: _id.toHexString(),
        version,
      });
    }
  }

  private async create(document: TDocument): Promise<void> {
    try {
      await new this.model({ ...document, version: 1 }).save();
    } catch (error) {
      if (isDuplicateKey(error, "_id")) {
        throw new AppError(SharedError.AlreadyExists, {
          id: document._id.toHexString(),
        });
      }
      throw error;
    }
  }
}
