import { mongo } from "mongoose";

export const isDuplicateKey = (error: unknown, field: string): boolean =>
  error instanceof mongo.MongoServerError &&
  error.code === 11000 &&
  field in (error.keyPattern ?? {});
