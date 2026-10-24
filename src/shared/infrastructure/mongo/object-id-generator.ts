import { IdGenerator } from "@shared/application/ports/id-generator";
import { Types } from "mongoose";

export class ObjectIdGenerator implements IdGenerator {
  next(): string {
    return new Types.ObjectId().toHexString();
  }
}
